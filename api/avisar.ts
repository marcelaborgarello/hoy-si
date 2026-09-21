import pino from 'pino'
import type { PushSubscription } from 'web-push'
import { estadoAdmin, getDbAdmin } from './_firebase.js'

const log = pino({ name: 'avisar' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.CRON_SECRET

/**
 * Claves de Web Push. Son un PAR y tienen que casar: si la pública con la que
 * se suscribió el navegador no es la misma con la que se firma acá, el aviso
 * sale, el celular lo descarta y no se queja nadie. Por eso las dos salen de
 * variables y no hay ninguna pegada en el código.
 *
 * El `.trim()` no es adorno: pegar una clave en el panel de Vercel y que se
 * lleve un espacio o un salto de línea es de lo más común, y `web-push`
 * rechaza la clave entera por ese carácter de más.
 */
const VAPID_PUBLICA = process.env.VITE_VAPID_PUBLIC_KEY?.trim()
const VAPID_PRIVADA = process.env.VAPID_PRIVATE_KEY?.trim()

/**
 * Manda los avisos que tocan ahora.
 *
 * Lo llama un Worker de Cloudflare cada minuto. En vez de recorrer todas las
 * tareas y calcular horarios, consulta las que tienen `nextNotifyAt` vencido:
 * ese campo lo deja calculado el cliente al guardar.
 *
 * Después de mandar, avanza `nextNotifyAt` al siguiente aviso (el de la hora
 * exacta, si el que salió era el anticipado) o lo apaga con null.
 */

/** Tope por corrida: si algo se desmadra, no manda mil mensajes de una. */
const MAX_POR_CORRIDA = 50

/**
 * Cuánto tarde es "demasiado tarde" para avisar. Si el sistema estuvo caído,
 * no tiene sentido avisarte a las 3 de la mañana de algo de ayer al mediodía.
 */
const TOLERANCIA_MIN = 120

type TareaDoc = {
  title?: string
  description?: string
  dueDate?: string | null
  dueTime?: string | null
  notify?: boolean
  notifyAtTime?: boolean
  notifyBeforeMin?: number | null
  /** Horario de la tarea ya resuelto por el navegador (epoch ms). */
  dueAt?: number | null
  nextNotifyAt?: number | null
  status?: string
}

/**
 * ⚠️ ACÁ NO SE ARMAN FECHAS. Nunca `new Date(año, mes, día, hora)` a partir de
 * dueDate/dueTime.
 *
 * Este código corre en UTC y el navegador en la zona de quien usa la app.
 * Interpretar "15:36" acá lo entiende como 15:36 UTC, y se equivoca por las
 * horas de diferencia que haya. Ya pasó: el mensaje decía "es ahora" cuando
 * faltaban diez minutos, y el segundo aviso quedaba sin programar porque al
 * recalcular daba todo "en el pasado".
 *
 * El horario resuelto viene en `dueAt`, calculado por el navegador. Acá solo
 * se comparan y restan números.
 */
function proximoAviso(t: TareaDoc, desde: number): number | null {
  if (!t.notify || t.status === 'done' || !t.dueAt) return null

  // Los dos avisos son independientes: puede haber solo el anticipado, solo
  // el de la hora, o los dos. Las tareas viejas no tienen notifyAtTime, y
  // para esas el de la hora va (que es como venían funcionando).
  const momentos: number[] = []
  if (t.notifyBeforeMin) momentos.push(t.dueAt - t.notifyBeforeMin * 60_000)
  if (t.notifyAtTime ?? true) momentos.push(t.dueAt)

  return momentos.find((m) => m > desde) ?? null
}

const APP_URL = 'https://tareas.ginialtech.com'

/** Telegram rompe el mensaje si el texto trae <, > o &. */
function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function enviar(
  chatId: string,
  texto: string,
  botones?: unknown,
): Promise<boolean> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      // Sin esto Telegram muestra una vista previa enorme del link.
      link_preview_options: { is_disabled: true },
      ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
    }),
  })
  if (!r.ok) log.error({ status: r.status }, 'Telegram rechazo el envio')
  return r.ok
}

/** Cuándo es, en palabras. Sirve igual para Telegram y para el celular. */
function cuandoEs(t: TareaDoc, faltan: number, negrita: (s: string) => string): string {
  if (faltan <= 0) return `Es ${negrita('ahora')}, a las ${t.dueTime}`
  if (faltan >= 1440) return `Es mañana a las ${t.dueTime}`
  if (faltan >= 60) return `Es en ${Math.round(faltan / 60)} h, a las ${t.dueTime}`
  return `Es en ${faltan} min, a las ${t.dueTime}`
}

/** El mensaje de Telegram, que entiende HTML. */
function armarMensaje(t: TareaDoc, faltan: number): string {
  const desc = t.description?.trim()
  return [
    `⏰ <b>${escapar(t.title ?? '')}</b>`,
    desc ? `\n${escapar(desc.slice(0, 300))}` : '',
    `\n${cuandoEs(t, faltan, (s) => `<b>${s}</b>`)}.`,
  ].join('')
}

/**
 * El cuerpo del aviso del celular.
 *
 * ⚠️ Acá NO va HTML. Una notificación del sistema muestra el texto tal cual:
 * mandarle el mensaje de Telegram hacía que se leyera «⏰ <b>Comprar pan</b>»
 * con las etiquetas a la vista. El título va aparte, así que el cuerpo
 * arranca en la descripción.
 */
function armarCuerpoPush(t: TareaDoc, faltan: number): string {
  const desc = t.description?.trim()
  const cuando = `${cuandoEs(t, faltan, (s) => s)}.`
  return desc ? `${desc.slice(0, 150)}\n${cuando}` : cuando
}

/**
 * Prepara `web-push`, una sola vez y sin poder tirar abajo nada.
 *
 * ⚠️ Esto ANTES vivía arriba de todo, en el cuerpo del módulo, y ahí es
 * donde muerde: `setVapidDetails` valida las claves y **tira una excepción**
 * si alguna no tiene el largo exacto. Una excepción en el cuerpo del módulo
 * hace que la función ni arranque (FUNCTION_INVOCATION_FAILED) y se caen
 * TODOS los avisos, también los de Telegram, que no tienen nada que ver.
 *
 * Es el mismo motivo por el que `_firebase.ts` importa firebase-admin de
 * forma dinámica. Misma trampa, misma solución.
 */
let push: typeof import('web-push') | null = null
let pushRevisado = false

/**
 * Por qué no se pudo preparar. Se muestra en el diagnóstico.
 *
 * Los mensajes de web-push son del estilo "Vapid private key should be 32
 * bytes long when decoded" o "must be a URL safe Base 64": dicen **cuál** de
 * las dos claves está mal y **qué** tiene de malo, y **nunca incluyen la
 * clave**. Verificado probando los errores más comunes (comillas alrededor
 * del valor, un `=` al final, o la pública pegada en la privada).
 */
let motivoPush: string | null = null

async function prepararPush(): Promise<typeof import('web-push') | null> {
  if (pushRevisado) return push
  pushRevisado = true

  if (!VAPID_PUBLICA || !VAPID_PRIVADA) {
    log.error(
      { publica: VAPID_PUBLICA ? 'ok' : 'FALTA', privada: VAPID_PRIVADA ? 'ok' : 'FALTA' },
      'avisos del celular apagados: faltan claves VAPID en Vercel',
    )
    return null
  }

  try {
    const mod = await import('web-push')
    const webpush = mod.default ?? mod
    webpush.setVapidDetails('mailto:ginialtech@gmail.com', VAPID_PUBLICA, VAPID_PRIVADA)
    push = webpush
    return push
  } catch (err) {
    // Clave con el largo equivocado, mal copiada, o el módulo que no carga.
    // Se apagan los avisos del celular y Telegram sigue andando igual.
    motivoPush = err instanceof Error ? err.message : String(err)
    log.error({ motivo: motivoPush }, 'avisos del celular apagados')
    return null
  }
}

/**
 * El estado del push en una línea, para poder mirarlo sin acceso a los logs.
 *
 * Incluye el largo de cada clave porque es el dato que más rápido resuelve
 * el problema: la pública sana mide 87 caracteres y la privada 43. Un 44
 * suele ser un `=` de más, y un 45 o más, comillas alrededor del valor.
 * **El largo no revela la clave.**
 */
async function estadoPush(): Promise<string> {
  if (!VAPID_PUBLICA) return 'falta la clave publica'
  if (!VAPID_PRIVADA) return 'falta la clave privada'

  const medidas = `publica ${VAPID_PUBLICA.length} (sana: 87), privada ${VAPID_PRIVADA.length} (sana: 43)`
  if (await prepararPush()) return `ok — ${medidas}`
  return `${motivoPush ?? 'no se pudo preparar'} — ${medidas}`
}

/**
 * Manda el aviso al celular.
 *
 * Nada de `sound`: no existe en las notificaciones web (se sacó del estándar
 * en 2018). El sonido lo pone el sistema y se cambia desde el teléfono.
 */
async function enviarPush(
  token: string,
  titulo: string,
  cuerpo: string,
  taskId: string,
): Promise<boolean> {
  const webpush = await prepararPush()
  if (!webpush) return false

  try {
    const subscription = JSON.parse(token) as PushSubscription

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      icon: '/iconos/icono-192.png',
      // Una etiqueta por tarea: el aviso anticipado y el de la hora son dos
      // cosas distintas y no tienen que taparse entre sí.
      tag: `tarea-${taskId}`,
      url: APP_URL,
    })

    await webpush.sendNotification(subscription, payload)
    return true
  } catch (err) {
    // 404 y 410 quieren decir que ese teléfono ya no existe para nosotros
    // (desinstaló la app o revocó el permiso). No es un error a mirar.
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      log.info({ status }, 'suscripcion vencida, se ignora')
      return false
    }
    log.error({ err }, 'no se pudo enviar el aviso al celular')
    return false
  }
}

/**
 * Botones debajo del mensaje.
 *
 * "Ya la hice" y "En 10 min" hacen el trabajo sin salir de Telegram: si
 * tachar cuesta un toque desde donde ya estás, se tacha. Si hay que abrir la
 * app y buscar la tarea, muchas veces no.
 */
function armarBotones(uid: string, taskId: string) {
  return [
    [
      { text: '✓ Ya la hice', callback_data: `hecha:${uid}:${taskId}` },
      { text: '🕐 En 10 min', callback_data: `luego:${uid}:${taskId}` },
    ],
    [{ text: 'Abrir la lista', url: APP_URL }],
  ]
}

export async function POST(request: Request): Promise<Response> {
  if (!TOKEN || !SECRET) {
    log.error('faltan TELEGRAM_BOT_TOKEN o CRON_SECRET')
    return new Response(null, { status: 500 })
  }

  // La URL es pública: sin esto, cualquiera podría disparar los avisos.
  if (request.headers.get('x-cron-secret') !== SECRET) {
    return new Response(null, { status: 401 })
  }

  const db = await getDbAdmin()
  if (!db) {
    log.error({ estado: estadoAdmin() }, 'sin conexion a Firestore')
    return new Response(null, { status: 500 })
  }

  const ahora = Date.now()

  // Una sola consulta para todos los usuarios: las tareas viven en
  // users/{uid}/tasks, así que va por grupo de colecciones.
  const pendientes = await db
    .collectionGroup('tasks')
    .where('nextNotifyAt', '<=', ahora)
    .orderBy('nextNotifyAt')
    .limit(MAX_POR_CORRIDA)
    .get()

  if (pendientes.empty) {
    // El estado del push va en la respuesta a propósito: ni la dueña del
    // proyecto ni yo podemos leer los Runtime Logs, así que sin esto no hay
    // forma de saber si las claves VAPID sirven. Se ve abriendo la URL del
    // Worker (ver worker/README.md). No revela ninguna clave.
    return Response.json({ revisadas: 0, enviados: 0, push: await estadoPush() })
  }

  // Primero: colectar todos los uids únicos y pre-filtrar tareas inválidas.
  const uidsUnicos = new Set<string>()
  const tareasValidas: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot; uid: string; tarea: TareaDoc }> = []

  for (const doc of pendientes.docs) {
    const uid = doc.ref.parent.parent?.id
    const t = doc.data() as TareaDoc

    // Sin dueAt no se puede saber cuánto falta sin equivocarse de zona. Son
    // tareas guardadas antes de que ese campo existiera: se apagan y se
    // reactivan solas la próxima vez que se toque la tarea desde la app.
    if (!uid || !t.nextNotifyAt || !t.dueTime || !t.title || !t.dueAt) {
      if (t.nextNotifyAt) await doc.ref.update({ nextNotifyAt: null })
      continue
    }

    uidsUnicos.add(uid)
    tareasValidas.push({ doc, uid, tarea: t })
  }

  // Segundo: obtener todos los chatIds y tokens push en una sola ronda de consultas.
  const chats = new Map<string, string | null>()
  const pushTokens = new Map<string, string | null>()
  const configsPromises = Array.from(uidsUnicos).map(async (uid) => {
    const cfg = await db.doc(`users/${uid}/config/avisos`).get()
    const data = cfg.data() as { telegramChatId?: string; avisos?: boolean } | undefined
    chats.set(uid, data?.avisos && data.telegramChatId ? data.telegramChatId : null)

    // Obtener token push si existe
    const pushCfg = await db.doc(`users/${uid}/config/push`).get()
    const pushData = pushCfg.data() as { token?: string } | undefined
    pushTokens.set(uid, pushData?.token || null)
  })
  await Promise.all(configsPromises)

  // Tercero: procesar las tareas en paralelo con límite de concurrencia.
  let enviados = 0
  let vencidos = 0
  const CONCURRENCIA_MAX = 5 // No saturar ni Telegram ni Firestore

  async function procesarTarea({ doc, uid, tarea: t }: typeof tareasValidas[0]) {
    const siguiente = proximoAviso(t, t.nextNotifyAt!)
    const atrasoMin = (ahora - t.nextNotifyAt!) / 60_000

    if (atrasoMin > TOLERANCIA_MIN) {
      // Demasiado viejo: se saltea sin mandar, pero se ordena el próximo.
      await doc.ref.update({ nextNotifyAt: siguiente })
      return { tipo: 'vencido' as const }
    }

    const chatId = chats.get(uid)
    const pushToken = pushTokens.get(uid)

    // Si no tiene ni Telegram ni push, apagar los avisos
    if (!chatId && !pushToken) {
      await doc.ref.update({ nextNotifyAt: null })
      return { tipo: 'sin-chat' as const }
    }

    // Resta de dos números absolutos: no hay zonas horarias de por medio.
    const faltanMin = Math.round((t.dueAt! - t.nextNotifyAt!) / 60_000)

    // Enviar por Telegram si está conectado
    let telegramOk = false
    if (chatId) {
      telegramOk = await enviar(chatId, armarMensaje(t, faltanMin), armarBotones(uid, doc.id))
    }

    // Enviar al celular si dejó los avisos activados. El texto es otro:
    // Telegram entiende HTML y una notificación del sistema no.
    let pushOk = false
    if (pushToken) {
      pushOk = await enviarPush(
        pushToken,
        t.title || 'Hoy sí',
        armarCuerpoPush(t, faltanMin),
        doc.id,
      )
    }

    // Se avanza igual si alguno falló: reintentar en loop es peor que
    // perder un aviso, y el error queda en los logs.
    await doc.ref.update({ nextNotifyAt: siguiente })
    return { tipo: 'enviado' as const, ok: telegramOk || pushOk }
  }

  // Procesar en batches para no saturar.
  for (let i = 0; i < tareasValidas.length; i += CONCURRENCIA_MAX) {
    const batch = tareasValidas.slice(i, i + CONCURRENCIA_MAX)
    const resultados = await Promise.all(batch.map(procesarTarea))
    for (const r of resultados) {
      if (r.tipo === 'vencido') vencidos++
      if (r.tipo === 'enviado' && r.ok) enviados++
    }
  }

  log.info({ revisadas: pendientes.size, enviados, vencidos }, 'corrida de avisos')
  return Response.json({ revisadas: pendientes.size, enviados, vencidos, push: await estadoPush() })
}
