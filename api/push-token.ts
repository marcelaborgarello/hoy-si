import pino from 'pino'
import { estadoAdmin, getDbAdmin } from './_firebase.js'

const log = pino({ name: 'push-token' })

/**
 * Guarda el token de notificaciones push del usuario.
 *
 * El navegador genera este token cuando el usuario acepta las notificaciones.
 * Lo guardamos en Firestore para poder mandar notificaciones push específicas.
 */
export async function POST(request: Request): Promise<Response> {
  const db = await getDbAdmin()
  if (!db) {
    log.error({ estado: estadoAdmin() }, 'sin conexion a Firestore')
    return new Response(null, { status: 500 })
  }

  try {
    const { uid, token } = (await request.json()) as { uid?: string; token?: string }

    if (!uid || !token) {
      return Response.json({ error: 'faltan uid o token' }, { status: 400 })
    }

    // Guardar el token en el documento de configuración del usuario
    await db.doc(`users/${uid}/config/push`).set(
      {
        token,
        updatedAt: Date.now(),
      },
      { merge: true },
    )

    log.info({ uid }, 'token push guardado')
    return Response.json({ success: true })
  } catch (err) {
    log.error({ err }, 'error al guardar token push')
    return Response.json({ error: 'error al guardar token' }, { status: 500 })
  }
}
