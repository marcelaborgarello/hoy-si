import pino from 'pino'
// La extensión .js es obligatoria: el proyecto es ESM ("type": "module") y
// Node no resuelve imports relativos sin ella. Sin esto la función ni
// arranca y Vercel devuelve FUNCTION_INVOCATION_FAILED.
import { estadoAdmin, getDbAdmin } from './_firebase.js'

/**
 * Webhook del bot @hoysi_tareas_bot.
 *
 * Telegram llama acá cada vez que alguien le escribe al bot. Por ahora hace
 * una sola cosa: cuando mandás /start, te devuelve tu código de chat, que es
 * el que después se pega en la app para vincular las alertas.
 *
 * El token del bot vive únicamente en las variables de entorno del servidor.
 * Nunca llega al navegador.
 */

const log = pino({ name: 'telegram' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; first_name?: string }
  }
  /** Llega cuando se toca un botón de los que van debajo del aviso. */
  callback_query?: {
    id?: string
    data?: string
    message?: { chat?: { id?: number }; message_id?: number }
  }
}

/** Cuánto se posterga con el botón "En 10 min". */
const POSPONER_MIN = 10

/** Los códigos de vinculación caducan: uno viejo no sirve para engancharse. */
const VALIDEZ_MIN = 15

/**
 * Engancha este chat con la cuenta que generó el código.
 *
 * El código se gasta al usarlo, así que no queda dando vueltas. Escribir el
 * chat lo hace el servidor a propósito: es el único que puede comprobar de
 * verdad que ese chat le habló al bot.
 */
async function vincular(codigo: string, chatId: number): Promise<boolean> {
  const db = await getDbAdmin()
  if (!db) {
    log.error({ estado: estadoAdmin() }, 'no se pudo conectar a Firestore para vincular')
    return false
  }

  const ref = db.collection('vinculos').doc(codigo)
  const snap = await ref.get()
  if (!snap.exists) return false

  const { uid, creadoEn } = (snap.data() ?? {}) as { uid?: string; creadoEn?: number }
  await ref.delete()

  if (!uid || !creadoEn) return false
  if (Date.now() - creadoEn > VALIDEZ_MIN * 60_000) return false

  await db
    .doc(`users/${uid}/config/avisos`)
    .set({ telegramChatId: String(chatId), avisos: true }, { merge: true })

  log.info({ uid }, 'chat de Telegram vinculado')
  return true
}

/**
 * Atiende los botones del aviso: tachar la tarea o postergarla.
 *
 * El `uid` viene dentro del botón, pero **no se confía en él**: se comprueba
 * que el chat que toca el botón sea el que esa cuenta tiene vinculado. Sin
 * eso, cualquiera que adivinara un id podría tachar tareas ajenas.
 *
 * Devuelve el texto del cartelito que Telegram muestra arriba.
 */
async function atenderBoton(data: string, chatId: number): Promise<string> {
  const [accion, uid, taskId] = data.split(':')
  if (!accion || !uid || !taskId) return 'No entendí ese botón'

  const db = await getDbAdmin()
  if (!db) {
    log.error({ estado: estadoAdmin() }, 'sin Firestore para atender el boton')
    return 'No me pude conectar. Probá desde la app'
  }

  const cfg = await db.doc(`users/${uid}/config/avisos`).get()
  if ((cfg.data() as { telegramChatId?: string } | undefined)?.telegramChatId !== String(chatId)) {
    log.warn({ uid }, 'boton de Telegram con chat que no corresponde')
    return 'Ese aviso no es tuyo'
  }

  const ref = db.doc(`users/${uid}/tasks/${taskId}`)
  const snap = await ref.get()
  if (!snap.exists) return 'Esa tarea ya no está'

  const t = snap.data() as { startedAt?: number | null; dueAt?: number | null }
  const ahora = Date.now()

  if (accion === 'hecha') {
    await ref.update({
      status: 'done',
      startedAt: t.startedAt ?? ahora,
      finishedAt: ahora,
      // Tachada no avisa más, ni el que quedaba pendiente.
      nextNotifyAt: null,
    })
    log.info({ uid }, 'tarea tachada desde Telegram')
    return '✓ Tachada'
  }

  if (accion === 'luego') {
    await ref.update({ nextNotifyAt: ahora + POSPONER_MIN * 60_000 })
    log.info({ uid }, 'aviso pospuesto desde Telegram')
    return `🕐 Te aviso en ${POSPONER_MIN} minutos`
  }

  return 'No entendí ese botón'
}

/** El cartelito que Telegram muestra arriba al tocar un botón. */
async function avisarDelBoton(callbackId: string, texto: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: texto }),
  })
}

async function responder(chatId: number, texto: string): Promise<void> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
  })
  if (!r.ok) {
    log.error({ status: r.status }, 'Telegram rechazo el envio')
  }
}

/**
 * Diagnóstico: dice si el servidor ve las variables, nunca su contenido.
 * Sirve para saber si faltan o si quedaron cargadas en el entorno equivocado.
 */
const WEBHOOK_URL = 'https://tareas.ginialtech.com/api/telegram'

export async function GET(request: Request): Promise<Response> {
  const accion = new URL(request.url).searchParams.get('accion')

  /**
   * Le dice a Telegram a qué URL mandar los mensajes.
   *
   * Lo hace el propio servidor con SU copia del secreto: así nadie de afuera
   * necesita conocer el valor para configurarlo, y no importa si al copiarlo
   * se perdió un carácter. La URL está fija en el código, así que llamar a
   * esto desde afuera no permite desviar el bot a ningún lado.
   */
  if (accion === 'configurar') {
    if (!TOKEN || !SECRET) return Response.json({ error: 'faltan variables' }, { status: 500 })

    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: SECRET,
        // callback_query son los botones del aviso. Sin declararlo acá,
        // Telegram no los manda y tocarlos no hace nada.
        allowed_updates: ['message', 'callback_query'],
      }),
    })
    return Response.json(await r.json(), { status: r.ok ? 200 : 502 })
  }

  // Prueba real de conexión a Firestore, que es donde puede fallar la
  // credencial aunque la variable exista.
  if (accion === 'probar-firebase') {
    const db = await getDbAdmin()
    return Response.json({ conectado: Boolean(db), estado: estadoAdmin() })
  }

  if (accion === 'estado') {
    if (!TOKEN) return Response.json({ error: 'falta el token' }, { status: 500 })
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
    return Response.json(await r.json())
  }

  return Response.json({
    TELEGRAM_BOT_TOKEN: TOKEN ? `ok (${TOKEN.length} caracteres)` : 'FALTA',
    TELEGRAM_WEBHOOK_SECRET: SECRET ? `ok (${SECRET.length} caracteres)` : 'FALTA',
    FIREBASE_SERVICE_ACCOUNT: estadoAdmin(),
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!TOKEN || !SECRET) {
    log.error('faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET')
    return new Response(null, { status: 500 })
  }

  // Esta URL es pública: sin este chequeo, cualquiera podría hacerse pasar
  // por Telegram y hacer que el bot escriba lo que quiera.
  if (request.headers.get('x-telegram-bot-api-secret-token') !== SECRET) {
    return new Response(null, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response(null, { status: 400 })
  }

  // Botones del aviso: tachar o posponer, sin salir de Telegram.
  const boton = update.callback_query
  if (boton?.id && boton.data && boton.message?.chat?.id) {
    const resultado = await atenderBoton(boton.data, boton.message.chat.id)
    await avisarDelBoton(boton.id, resultado)
    return new Response(null, { status: 200 })
  }

  const chatId = update.message?.chat?.id
  const texto = update.message?.text?.trim() ?? ''

  // Siempre 200: si respondemos error, Telegram reintenta el mismo mensaje.
  if (!chatId) return new Response(null, { status: 200 })

  const nombre = update.message?.chat?.first_name ?? ''

  if (texto.startsWith('/start')) {
    // El link de la app viene como "/start <código>". Ese código dice a qué
    // cuenta hay que enganchar este chat, sin que la persona copie nada.
    const codigo = texto.slice('/start'.length).trim()

    if (!codigo) {
      await responder(
        chatId,
        `¡Hola${nombre ? ' ' + nombre : ''}! Soy el bot de <b>Hoy sí</b>.\n\n` +
          `Para conectarte, entrá a la app, andá a <b>Configuración</b> y tocá ` +
          `«Conectar Telegram». Ese botón te trae de vuelta acá y listo.`,
      )
      return new Response(null, { status: 200 })
    }

    const ok = await vincular(codigo, chatId)
    await responder(
      chatId,
      ok
        ? `¡Listo${nombre ? ', ' + nombre : ''}! 🎉\n\nDesde ahora te aviso por acá cuando ` +
            `se acerque el horario de una tarea.`
        : `Ese código ya venció o no es válido.\n\nVolvé a la app, a <b>Configuración</b>, ` +
            `y tocá «Conectar Telegram» de nuevo.`,
    )
  } else {
    await responder(chatId, 'Para conectarte, usá el botón «Conectar Telegram» de la app.')
  }

  return new Response(null, { status: 200 })
}
