import { log } from './logger'

/**
 * Todo lo que tiene que ver con instalar la app en el celular.
 *
 * Dos cosas distintas viven acá:
 *
 * 1. Registrar el service worker (sin eso el navegador ni considera que la
 *    app se pueda instalar).
 * 2. Quedarse con el evento `beforeinstallprompt`, que es lo que permite
 *    mostrar un botón propio de "Instalar".
 *
 * Lo segundo hay que hacerlo **apenas arranca la página**, antes de que
 * React monte nada: Chrome dispara ese evento una sola vez y muy temprano.
 * Si no hay nadie escuchando en ese momento, se pierde y ya no vuelve.
 * Por eso esto se engancha al importar el módulo y no adentro de un hook.
 */

/** El evento de Chrome. No está en los tipos del DOM porque no es estándar. */
type EventoDeInstalacion = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** El evento guardado, o null si el navegador todavía no lo ofreció. */
let pendiente: EventoDeInstalacion | null = null

/** Quién quiere enterarse de que cambió. Lo usa useSyncExternalStore. */
const oyentes = new Set<() => void>()

function avisarCambio(): void {
  for (const fn of oyentes) fn()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sin esto Chrome maneja el cartel por su cuenta y no nos deja elegir
    // ni cuándo ni cómo mostrarlo.
    e.preventDefault()
    pendiente = e as EventoDeInstalacion
    avisarCambio()
  })

  // Si la instaló (por el toast o por el menú del navegador), no hay más
  // nada que ofrecer.
  window.addEventListener('appinstalled', () => {
    pendiente = null
    avisarCambio()
    log.info({ scope: 'pwa' }, 'la app quedó instalada')
  })
}

export function suscribirseAInstalable(fn: () => void): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

/** Si el navegador ya ofreció la instalación de un toque. */
export function hayInstalacionDeUnToque(): boolean {
  return pendiente !== null
}

/**
 * Si la app ya se está usando instalada.
 *
 * `display-mode: standalone` es lo que responde cualquier navegador; el
 * `navigator.standalone` es el de Safari en iPhone, que es el único que no
 * implementa lo otro.
 */
export function yaEstaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Si es un iPhone o iPad.
 *
 * Importa porque Safari **nunca** dispara `beforeinstallprompt`: ahí no hay
 * botón posible y lo único que se puede hacer es explicar el camino a mano
 * (Compartir → Agregar a inicio).
 *
 * El iPad moderno miente y dice que es una Mac, así que se lo reconoce por
 * tener pantalla táctil.
 */
export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return true
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
}

/**
 * Abre el cartel de instalación del navegador.
 *
 * Devuelve qué pasó para que quien llama pueda decidir si esconde el toast.
 * El evento se usa una sola vez: después de mostrarlo hay que soltarlo.
 */
export async function instalar(): Promise<'instalada' | 'rechazada' | 'sin-oferta'> {
  const evento = pendiente
  if (!evento) return 'sin-oferta'

  try {
    await evento.prompt()
    const { outcome } = await evento.userChoice
    pendiente = null
    avisarCambio()
    return outcome === 'accepted' ? 'instalada' : 'rechazada'
  } catch (err) {
    log.warn({ scope: 'pwa' }, `no se pudo abrir el cartel de instalar: ${String(err)}`)
    pendiente = null
    avisarCambio()
    return 'sin-oferta'
  }
}

/**
 * Registra el service worker, que es lo que hace que la app ABRA sin internet
 * y lo que habilita las notificaciones push.
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
