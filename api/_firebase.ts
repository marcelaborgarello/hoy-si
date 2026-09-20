import type { Firestore } from 'firebase-admin/firestore'

/**
 * Firebase del lado del servidor. Usa la cuenta de servicio, así que se
 * saltea las reglas de seguridad: solo puede vivir acá dentro, nunca en el
 * navegador.
 *
 * El import es **dinámico a propósito**: firebase-admin es pesado y si falla
 * al cargarse tira abajo el módulo entero y la función ni arranca
 * (FUNCTION_INVOCATION_FAILED). Así, si algo anda mal, el webhook sigue
 * respondiendo y el error queda a la vista en vez de romper todo.
 */

let db: Firestore | null = null
let ultimoError: string | null = null

export async function getDbAdmin(): Promise<Firestore | null> {
  if (db) return db

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    ultimoError = 'falta FIREBASE_SERVICE_ACCOUNT'
    return null
  }

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')

    const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) })
    db = getFirestore(app)
    ultimoError = null
    return db
  } catch (err) {
    ultimoError = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return null
  }
}

/** Diagnóstico: por qué no se pudo conectar. Nunca incluye la credencial. */
export function estadoAdmin(): string {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return 'FALTA'
  return ultimoError ? `ERROR: ${ultimoError}` : 'ok'
}
