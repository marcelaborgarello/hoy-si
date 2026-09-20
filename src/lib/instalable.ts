import { log } from './logger'

/**
 * Registra el service worker que hace instalable la app.
 *
 * Solo en producción: en desarrollo interfiere con la recarga en caliente de
 * Vite y hace perder tiempo persiguiendo cambios que no aparecen.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  // Después de que cargue todo: registrarlo antes compite con la pantalla.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Que no se pueda instalar no puede romper la app.
      log.warn({ scope: 'pwa' }, `no se pudo registrar el service worker: ${String(err)}`)
    })
  })
}
