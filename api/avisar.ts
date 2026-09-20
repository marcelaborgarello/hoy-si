import pino from 'pino'
import webpush from 'web-push'
import { estadoAdmin, getDbAdmin } from './_firebase.js'

const log = pino({ name: 'avisar' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.CRON_SECRET

// Configurar Web Push con claves VAPID generadas
// La clave privada viene de Vercel para no exponerla en el código
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
if (!vapidPrivateKey) {
  log.error('falta VAPID_PRIVATE_KEY en Vercel')
} else {
  webpush.setVapidDetails(
    'mailto:ginialtech@gmail.com',
    'BN49kfeQnyY9aTOQdk3O9ZLPIDMYCEu71OlyxWMaHeK4eNtYHo4n0YDVXsy9HCwt5nMKTjY14mz7li_ePQ58bb8',
    vapidPrivateKey,
  )
}

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

/** El texto que llega al teléfono. Distinto si es el anticipado o el de la hora. */
function armarMensaje(t: TareaDoc, faltan: number): string {
  const cuando =
    faltan <= 0
      ? `Es <b>ahora</b>, a las ${t.dueTime}`
      : faltan >= 1440
        ? `Es mañana a las ${t.dueTime}`
        : faltan >= 60
          ? `Es en ${Math.round(faltan / 60)} h, a las ${t.dueTime}`
          : `Es en ${faltan} min, a las ${t.dueTime}`

  const desc = t.description?.trim()
  return [
    `⏰ <b>${escapar(t.title ?? '')}</b>`,
    desc ? `\n${escapar(desc.slice(0, 300))}` : '',
    `\n${cuando}.`,
  ].join('')
}

async function enviarPush(
  token: string,
  titulo: string,
  cuerpo: string,
): Promise<boolean> {
  if (!vapidPrivateKey) {
    log.warn('notificacion push no enviada: falta VAPID_PRIVATE_KEY en Vercel')
    return false
  }

  try {
    const subscription = JSON.parse(token) as webpush.PushSubscription

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      icon: '/iconos/icono-192.png',
      sound: '/sounds/notificacion.mp3',
      vibrate: [200, 100, 200],
      url: 'https://tareas.ginialtech.com',
    })

    await webpush.sendNotification(subscription, payload)
    log.info({ titulo }, 'notificacion push enviada')
    return true
  } catch (err) {
    log.error({ err }, 'error al enviar notificacion push')
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
    return Response.json({ revisadas: 0, enviados: 0 })
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
    const mensaje = armarMensaje(t, faltanMin)

    // Enviar por Telegram si está conectado
    let telegramOk = false
    if (chatId) {
      telegramOk = await enviar(chatId, mensaje, armarBotones(uid, doc.id))
    }

    // Enviar push si tiene token
    let pushOk = false
    if (pushToken) {
      pushOk = await enviarPush(pushToken, t.title || 'Hoy sí', mensaje)
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
  return Response.json({ revisadas: pendientes.size, enviados, vencidos })
}
