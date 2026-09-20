import { useCallback, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { getAuthInstance, isFirebaseConfigured } from '../lib/firebase'
import { log } from '../lib/logger'

export type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
  /** true cuando no hay Firebase: la app corre en modo local, sin login. */
  offline: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

/**
 * Login con Google. El uid que devuelve es lo que las reglas de Firestore
 * usan para dejarte entrar solo a /users/{uid}/tasks.
 */
export function useAuth(): AuthState {
  const auth = getAuthInstance()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [auth])

  const signIn = useCallback(async () => {
    if (!auth) return
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return // el usuario cerró la ventana: no es un error que mostrar
      }
      // El código se registra SIEMPRE (no se muestra en pantalla): sin esto, un
      // problema de configuración en producción es imposible de diagnosticar.
      // Ej: auth/unauthorized-domain = falta agregar el dominio en
      // Firebase Console -> Authentication -> Settings -> Authorized domains.
      log.error({ code }, `login fallido: ${code || (err as Error).message}`)
      setError(
        code === 'auth/network-request-failed'
          ? 'Parece que no hay internet. Probá de nuevo en un rato.'
          : 'No pudimos entrar con esa cuenta. Probá de nuevo.',
      )
    }
  }, [auth])

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth)
  }, [auth])

  return { user, loading, error, offline: !isFirebaseConfigured, signIn, signOut }
}
