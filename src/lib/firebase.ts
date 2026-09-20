import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Firestore solo se enciende si TODAS las claves están completas.
 * Si falta alguna (o quedó el placeholder TU_API_KEY), la app cae a localStorage
 * y sigue andando igual. Nada de pantallas en blanco por config a medias.
 */
export const isFirebaseConfigured = Object.values(config).every(
  (v) => typeof v === 'string' && v.length > 0 && !v.startsWith('TU_'),
)

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) app = initializeApp(config)
  return app
}

export function getDb(): Firestore | null {
  const a = getApp()
  if (!a) return null
  if (!db) db = getFirestore(a)
  return db
}

export function getAuthInstance(): Auth | null {
  const a = getApp()
  if (!a) return null
  if (!auth) auth = getAuth(a)
  return auth
}
