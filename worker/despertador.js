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

  // Permite probarlo a mano abriendo la URL del Worker, sin esperar al minuto.
  async fetch(request, env) {
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
