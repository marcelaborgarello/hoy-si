/**
 * Service worker de "Hoy sí".
 *
 * Hace dos cosas:
 * 1. Que la app ABRA sin internet (caché de archivos básicos)
 * 2. Manejar notificaciones push con sonido personalizado
 */

const CACHE = 'hoy-si-v1'

/** Lo mínimo para que la pantalla aparezca sin conexión. */
const BASICOS = ['/', '/index.html', '/manifest.webmanifest', '/logo.svg']

/**
 * Rutas que el service worker deja pasar derecho, SIEMPRE.
 *
 * - /api/      → los avisos y los logs. Cachearlos sería mandar datos viejos.
 * - /__/auth/  → el ida y vuelta del login con Google. Si se intercepta, no
 *                se puede entrar a la app.
 */
function esIntocable(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(BASICOS))
      // Si algo no se puede guardar, la app tiene que funcionar igual.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Solo se ocupa de lo propio, y solo de lecturas.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (esIntocable(url)) return

  /**
   * Primero la red, y el caché como respaldo.
   *
   * Al revés (caché primero) la app se quedaría mostrando una versión vieja
   * después de cada despliegue, que es peor que tardar un segundo más.
   */
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copia))
        }
        return resp
      })
      .catch(async () => {
        const guardado = await caches.match(e.request)
        if (guardado) return guardado
        // Es una navegación: se devuelve la pantalla principal.
        if (e.request.mode === 'navigate') {
          const inicio = await caches.match('/index.html')
          if (inicio) return inicio
        }
        return Response.error()
      }),
  )
})

/* ═══════════════════════════════════════════════════════════════════════
 * AVISOS QUE LLEGAN CON LA APP CERRADA
 *
 * ⚠️ NO se puede elegir el sonido desde acá. La propiedad `sound` se propuso
 * en 2014, ningún navegador la implementó y la sacaron del estándar en 2018.
 * Si aparece de nuevo en este archivo, es humo: el navegador ni la mira.
 *
 * El sonido lo decide el sistema. En Android se puede cambiar desde los
 * ajustes del teléfono, en el canal de notificaciones de este sitio — pero
 * eso lo elige quien usa la app, no este código.
 * ═══════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (e) => {
  if (!e.data) return

  // Si lo que llega no es el JSON esperado, igual hay que mostrar algo: un
  // aviso mudo es peor que uno genérico, porque la tarea se pasa lo mismo.
  let data = {}
  try {
    data = e.data.json()
  } catch {
    data = { body: e.data.text() }
  }

  const titulo = data.title || 'Hoy sí'

  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: data.body || '',
      icon: data.icon || '/iconos/icono-192.png',
      badge: '/iconos/icono-192.png',
      vibrate: [200, 100, 200],
      // Una etiqueta por tarea: dos avisos distintos no se pisan entre sí,
      // pero el mismo aviso repetido no se apila.
      tag: data.tag || 'hoy-si',
      requireInteraction: false,
      data: { url: data.url || '/' },
    }),
  )
})

/**
 * Al tocar el aviso se va a la app.
 *
 * Primero se busca una ventana ya abierta y se le da foco: abrir una nueva
 * cada vez deja tres copias de la lista dando vueltas.
 */
self.addEventListener('notificationclick', (e) => {
  e.notification.close()

  const destino = new URL(e.notification.data?.url || '/', self.location.origin)

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (new URL(v.url).origin === destino.origin && 'focus' in v) return v.focus()
      }
      return self.clients.openWindow(destino.href)
    }),
  )
})
