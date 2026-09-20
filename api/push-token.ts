import pino from 'pino'
import { estadoAdmin, getDbAdmin, uidDeLaSesion } from './_firebase.js'

const log = pino({ name: 'push-token' })

/**
 * Guarda la suscripción a los avisos del celular.
 *
 * ⚠️ El `uid` sale del token de la sesión, NO del cuerpo del pedido.
 *
 * Antes venía en el cuerpo y no se verificaba nada: con el uid de otra
 * persona, cualquiera podía registrar su propio teléfono y quedarse con los
 * avisos ajenos (que llevan el título de las tareas). Va en contra de la
 * regla del punto 6 de CLAUDE.md, y por eso ahora hay que probar la sesión.
 *
 * Hoy la app guarda esto directo en Firestore desde el navegador, donde las
 * reglas verifican lo mismo. Esta ruta queda como camino alternativo, pero
 * con el mismo candado: si está publicada, tiene que estar cerrada.
 */

/** Una suscripción ronda los 400 caracteres. Más que esto es basura. */
const MAX_TOKEN = 2000

export async function POST(request: Request): Promise<Response> {
  const uid = await uidDeLaSesion(request)
  if (!uid) {
    return Response.json({ error: 'sesion invalida' }, { status: 401 })
  }

  const db = await getDbAdmin()
  if (!db) {
    log.error({ estado: estadoAdmin() }, 'sin conexion a Firestore')
    return new Response(null, { status: 500 })
  }

  try {
    const { token } = (await request.json()) as { token?: unknown }

    if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) {
      return Response.json({ error: 'token invalido' }, { status: 400 })
    }

    await db.doc(`users/${uid}/config/push`).set(
      { token, updatedAt: Date.now() },
      { merge: true },
    )

    log.info({ uid }, 'suscripcion a avisos guardada')
    return Response.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'no se pudo guardar la suscripcion')
    return Response.json({ error: 'no se pudo guardar' }, { status: 500 })
  }
}
