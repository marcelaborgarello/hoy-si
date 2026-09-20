import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

/**
 * Firebase del lado del servidor. Usa la cuenta de servicio, así que se
 * saltea las reglas de seguridad: solo puede vivir acá dentro, nunca en el
 * navegador.
 *
 * La credencial viene del entorno (FIREBASE_SERVICE_ACCOUNT, el JSON entero).
 */

let app: App | null = null

function getAppAdmin(): App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null

  const existentes = getApps()
  if (existentes.length > 0) return existentes[0]

  if (!app) {
    app = initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  return app
}

export function getDbAdmin(): Firestore | null {
  const a = getAppAdmin()
  return a ? getFirestore(a) : null
}

export const hayCredencial = (): boolean => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT)
