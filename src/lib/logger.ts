import pino from 'pino'

/**
 * Único punto de logging de toda la app. En ningún otro archivo se llama a
 * console: si hace falta registrar algo, se usa `log`.
 *
 * Esta app corre entera en el navegador, así que pino escribe en la consola
 * del visitante. Lo que hace que los logs lleguen a Vercel es `transmit`:
 * manda los eventos importantes a /api/log, que es una función de servidor y
 * sí aparece en los Runtime Logs del panel.
 */

const endpoint = '/api/log'

/** No frenamos nada por un log: si el envío falla, se descarta y sigue. */
function enviarAlServidor(nivel: string, mensajes: unknown[]) {
  try {
    const body = JSON.stringify({
      level: nivel,
      msg: mensajes.map(aTextoPlano).join(' '),
      url: window.location.pathname,
      at: new Date().toISOString(),
    })

    // sendBeacon sobrevive a que se cierre la pestaña; fetch es el respaldo.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Un log roto nunca puede romper la app.
  }
}

/** Nada de objetos gigantes ni datos de la persona: solo texto acotado. */
function aTextoPlano(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return String(v)
  try {
    return JSON.stringify(v).slice(0, 500)
  } catch {
    return '[objeto]'
  }
}

export const log = pino({
  level: import.meta.env.DEV ? 'debug' : 'info',
  browser: {
    // Solo viajan al servidor los niveles que importan. Un debug local no
    // tiene por qué gastar red ni llenar los logs de Vercel.
    transmit: {
      level: 'warn',
      send: (nivel, evento) => {
        if (import.meta.env.DEV) return
        enviarAlServidor(nivel, evento.messages)
      },
    },
  },
})
