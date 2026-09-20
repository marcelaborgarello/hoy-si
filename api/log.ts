import pino from 'pino'

/**
 * Recibe los logs que manda el navegador y los escribe del lado del servidor,
 * que es lo único que aparece en los Runtime Logs de Vercel.
 *
 * Es un endpoint público, así que asume que puede recibir basura: limita el
 * tamaño, valida la forma y descarta todo lo demás sin hacer ruido.
 */

const log = pino({ name: 'hoy-si' })

const NIVELES = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
const MAX_BYTES = 4096
const MAX_MSG = 1000

export async function POST(request: Request): Promise<Response> {
  const largo = Number(request.headers.get('content-length') ?? 0)
  if (largo > MAX_BYTES) {
    return new Response(null, { status: 413 })
  }

  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return new Response(null, { status: 400 })
  }

  const { level, msg, url, at } = cuerpo as Record<string, unknown>

  if (typeof msg !== 'string' || msg.length === 0) {
    return new Response(null, { status: 400 })
  }

  const nivel = typeof level === 'string' && NIVELES.has(level) ? level : 'info'

  log[nivel as 'info']({
    desde: 'browser',
    url: typeof url === 'string' ? url.slice(0, 200) : undefined,
    at: typeof at === 'string' ? at.slice(0, 40) : undefined,
    ua: request.headers.get('user-agent')?.slice(0, 200),
  }, msg.slice(0, MAX_MSG))

  // 204: al navegador no le interesa la respuesta.
  return new Response(null, { status: 204 })
}
