import pino from 'pino'
import { estadoAdmin, getDbAdmin } from './_firebase.js'

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

const log = pino({ name: 'avisar' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.CRON_SECRET

/** Tope por corrida: si algo se desmadra, no manda mil mensajes de una. */
const MAX_POR_CORRIDA = 50

/**
 * Cuánto tarde es "demasiado tarde" para avisar. Si el sistema estuvo caído,
 * no tiene sentido avisarte a las 3 de la mañana de algo de ayer al mediodía.
 */
const TOLERANCIA_MIN = 120

type TareaDoc = {
  title?: string
  dueDate?: string | null
  dueTime?: string | null
  notify?: boolean
  notifyAtTime?: boolean
  notifyBeforeMin?: number | null
  nextNotifyAt?: number | null
  status?: string
}

/**
 * ⚠️ Espejo de `proximoAviso()` de `src/lib/alertas.ts`. Está duplicado a
 * propósito: aquel corre en el navegador con la cadena de imports del cliente,
 * y este en Node. Si se toca la lógica de horarios, hay que tocar los dos.
 */
function momentoExacto(dueDate: string, dueTime: string): number {
  const [y, m, d] = dueDate.split('-').map(Number)
  const [h, min] = dueTime.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0).getTime()
}

function proximoAviso(t: TareaDoc, desde: number): number | null {
  if (!t.notify || t.status === 'done' || !t.dueDate || !t.dueTime) return null

  const exacto = momentoExacto(t.dueDate, t.dueTime)

  // Los dos avisos son independientes: puede haber solo el anticipado, solo
  // el de la hora, o los dos. Las tareas viejas no tienen notifyAtTime, y
  // para esas el de la hora va (que es como venían funcionando).
  const momentos: number[] = []
  if (t.notifyBeforeMin) momentos.push(exacto - t.notifyBeforeMin * 60_000)
  if (t.notifyAtTime ?? true) momentos.push(exacto)

  return momentos.find((m) => m > desde) ?? null
}

async function enviar(chatId: string, texto: string): Promise<boolean> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
  })
  if (!r.ok) log.error({ status: r.status }, 'Telegram rechazo el envio')
  return r.ok
}

/** El texto que llega al teléfono. Distinto si es el anticipado o el de la hora. */
function armarMensaje(titulo: string, hora: string, faltan: number): string {
  if (faltan > 0) {
    const cuanto =
      faltan >= 1440
        ? 'mañana'
        : faltan >= 60
          ? `en ${Math.round(faltan / 60)} h`
          : `en ${faltan} min`
    return `⏰ <b>${titulo}</b>\n\nEs ${cuanto}, a las ${hora}.`
  }
  return `⏰ <b>${titulo}</b>\n\nEs ahora, a las ${hora}.`
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

  // El chat de cada persona se busca una sola vez aunque tenga varias tareas.
  const chats = new Map<string, string | null>()
  let enviados = 0
  let vencidos = 0

  for (const doc of pendientes.docs) {
    const uid = doc.ref.parent.parent?.id
    const t = doc.data() as TareaDoc
    if (!uid || !t.nextNotifyAt || !t.dueTime || !t.title) continue

    // Lo que corresponda a partir de ahora, sin importar lo que se mandó.
    const siguiente = proximoAviso(t, t.nextNotifyAt)
    const atrasoMin = (ahora - t.nextNotifyAt) / 60_000

    if (atrasoMin > TOLERANCIA_MIN) {
      // Demasiado viejo: se saltea sin mandar, pero se ordena el próximo.
      await doc.ref.update({ nextNotifyAt: siguiente })
      vencidos++
      continue
    }

    if (!chats.has(uid)) {
      const cfg = await db.doc(`users/${uid}/config/avisos`).get()
      const data = cfg.data() as { telegramChatId?: string; avisos?: boolean } | undefined
      chats.set(uid, data?.avisos && data.telegramChatId ? data.telegramChatId : null)
    }

    const chatId = chats.get(uid)
    if (!chatId) {
      // Sin Telegram conectado no hay a dónde mandarlo: se apaga y no se
      // reintenta en cada corrida.
      await doc.ref.update({ nextNotifyAt: null })
      continue
    }

    const faltanMin = Math.round((momentoExacto(t.dueDate!, t.dueTime) - t.nextNotifyAt) / 60_000)
    const ok = await enviar(chatId, armarMensaje(t.title, t.dueTime, faltanMin))

    // Se avanza igual si Telegram falló: reintentar en loop es peor que
    // perder un aviso, y el error queda en los logs.
    await doc.ref.update({ nextNotifyAt: siguiente })
    if (ok) enviados++
  }

  log.info({ revisadas: pendientes.size, enviados, vencidos }, 'corrida de avisos')
  return Response.json({ revisadas: pendientes.size, enviados, vencidos })
}
