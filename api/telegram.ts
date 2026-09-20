import pino from 'pino'

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

  const chatId = update.message?.chat?.id
  const texto = update.message?.text?.trim() ?? ''

  // Siempre 200: si respondemos error, Telegram reintenta el mismo mensaje.
  if (!chatId) return new Response(null, { status: 200 })

  const nombre = update.message?.chat?.first_name ?? ''

  if (texto.startsWith('/start')) {
    await responder(
      chatId,
      `¡Hola${nombre ? ' ' + nombre : ''}! Soy el bot de <b>Hoy sí</b>.\n\n` +
        `Para que te avise cuando vence una tarea, pegá este código en la app:\n\n` +
        `<code>${chatId}</code>\n\n` +
        `Lo encontrás en la app, arriba a la derecha, en Avisos.`,
    )
  } else {
    await responder(
      chatId,
      'Escribime /start y te paso tu código para conectar la app.',
    )
  }

  return new Response(null, { status: 200 })
}
