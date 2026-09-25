/**
 * Despertador de "Hoy sí".
 *
 * Cloudflare lo ejecuta cada minuto y su único trabajo es avisarle a la app
 * que revise si hay algo por mandar. Toda la lógica vive en la app: acá no hay
 * nada que entienda de tareas, horarios ni Telegram.
 *
 * Instrucciones de instalación: ver README.md
 */

const URL_AVISOS = 'https://tareas.ginialtech.com/api/avisar'

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tocarTimbre(env))
  },

  // Disparo manual, para no tener que esperar al minuto cuando se diagnostica.
  //
  // ⚠️ Exige el mismo secreto que usa la app. Sin esta comprobación, el Worker
  // era un botón público: cualquiera que conociera su URL forzaba una corrida
  // de avisos, quemaba cuota y podía duplicar mensajes si dos corridas se
  // solapaban. El Worker pone el secreto por su cuenta, así que sin pedir nada
  // estaba autenticando en nombre de quien golpeara la puerta.
  //
  // El secreto va en un ENCABEZADO y no en la URL a propósito: lo que viaja en
  // la query string queda escrito en logs, historiales y referers.
  //
  //   curl -H "x-cron-secret: <el secreto>" https://<worker>.workers.dev
  async fetch(request, env) {
    const secreto = request.headers.get('x-cron-secret')
    if (!env.CRON_SECRET || secreto !== env.CRON_SECRET) {
      // 404 en vez de 401: no hace falta confirmarle a nadie que acá hay algo.
      return new Response('Not found', { status: 404 })
    }

    const r = await tocarTimbre(env)
    return new Response(r, { headers: { 'content-type': 'text/plain' } })
  },
}

async function tocarTimbre(env) {
  if (!env.CRON_SECRET) {
    console.log('FALTA el secreto CRON_SECRET en las variables del Worker')
    return 'falta CRON_SECRET'
  }

  try {
    const r = await fetch(URL_AVISOS, {
      method: 'POST',
      headers: { 'x-cron-secret': env.CRON_SECRET },
    })

    if (!r.ok) {
      console.log(`La app rechazo la llamada: ${r.status}`)
      return `error: app rechazo ${r.status}`
    }

    const texto = await r.text()
    // Queda en los logs del Worker: sirve para ver si la app contesta bien.
    console.log(`${r.status} ${texto}`)
    return `${r.status} ${texto}`
  } catch (err) {
    // Un fallo de red no puede tirar abajo el Worker: se registra y listo.
    console.log(`error llamando a la app: ${err}`)
    return `error: ${err}`
  }
}
