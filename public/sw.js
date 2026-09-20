/**
 * Service worker de "Hoy sí".
 *
 * Hace una sola cosa: que la app ABRA sin internet. Las tareas son otro tema
 * —eso lo resuelve el caché de Firestore— y está anotado como pendiente.
 *
 * Escrito a mano y a propósito: lo importante acá es la lista de rutas que
 * NO se tocan, y conviene tenerla a la vista en vez de confiarla a la
 * configuración de una librería.
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
