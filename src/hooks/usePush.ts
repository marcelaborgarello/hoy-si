import { useCallback, useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import { log } from '../lib/logger'

/**
 * Avisos que llegan al celular aunque la app esté cerrada (Web Push).
 *
 * La suscripción **no se guarda en el navegador a mano**: el propio navegador
 * ya la tiene y se la pide con `pushManager.getSubscription()`. Duplicarla en
 * localStorage solo lograba que la pantalla dijera "activado" cuando en
 * realidad el permiso estaba revocado.
 *
 * Y se escribe **directo a Firestore, no por una ruta de `api/`**: ahí el uid
 * lo verifica Google contra la firma de la sesión. La ruta anterior aceptaba
 * cualquier uid que le mandaran, así que con el uid de otra persona se podían
 * desviar sus avisos. Las reglas ya tienen declarado el camino
 * `users/{uid}/config/push`.
 */

/** La clave pública del par VAPID. Es pública por diseño: va en el bundle. */
const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

type Estado = {
  permiso: NotificationPermission
  suscripto: boolean
  cargando: boolean
  resultado: 'exito' | 'error' | null
}

/**
 * La clave viaja en base64url y el navegador la quiere en bytes.
 *
 * Chrome acepta el texto directamente, pero no todos: pasarla convertida
 * funciona en todos lados y saca del medio una fuente de fallas silenciosas.
 */
function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  // El ArrayBuffer explícito es por el tipo: sin él, TypeScript no descarta
  // que sea un SharedArrayBuffer y subscribe() no lo acepta.
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length))
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

/** Si la suscripción que ya existe se hizo con esta misma clave pública. */
function mismaClave(sub: PushSubscription, clave: Uint8Array): boolean {
  const actual = sub.options?.applicationServerKey
  if (!actual) return false
  const bytes = new Uint8Array(actual)
  return bytes.length === clave.length && bytes.every((b, i) => b === clave[i])
}

const soportado =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export function usePush(uid: string | null) {
  const [estado, setEstado] = useState<Estado>({
    permiso: soportado ? Notification.permission : 'denied',
    suscripto: false,
    cargando: false,
    resultado: null,
  })

  // Al abrir la pantalla: preguntarle al navegador cómo está de verdad, en
  // vez de confiar en algo que anotamos nosotros la vez pasada.
  useEffect(() => {
    if (!soportado) return
    let vigente = true

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!vigente) return
        setEstado((p) => ({ ...p, permiso: Notification.permission, suscripto: sub !== null }))
      })
      .catch(() => {
        /* Que no se pueda averiguar no rompe la pantalla. */
      })

    return () => {
      vigente = false
    }
  }, [])

  /** Guarda la suscripción donde el servidor la va a buscar para avisarte. */
  const guardar = useCallback(
    async (sub: PushSubscription) => {
      const db = getDb()
      if (!db || !uid) throw new Error('sin base de datos o sin sesión')
      await setDoc(
        doc(db, `users/${uid}/config/push`),
        { token: JSON.stringify(sub), updatedAt: Date.now() },
        { merge: true },
      )
    },
    [uid],
  )

  const activar = useCallback(async (): Promise<boolean> => {
    if (!soportado || !uid) return false

    // Sin la clave pública no hay suscripción posible. Es lo que pasaba en
    // producción: la variable no estaba cargada y fallaba en el primer paso.
    if (!CLAVE_PUBLICA) {
      log.error({ scope: 'push' }, 'falta VITE_VAPID_PUBLIC_KEY en el build')
      setEstado((p) => ({ ...p, resultado: 'error' }))
      return false
    }

    setEstado((p) => ({ ...p, cargando: true, resultado: null }))

    try {
      // El permiso se pide desde el toque de la persona, nunca solo.
      const permiso = await Notification.requestPermission()
      setEstado((p) => ({ ...p, permiso }))

      if (permiso !== 'granted') {
        setEstado((p) => ({ ...p, cargando: false, resultado: 'error' }))
        return false
      }

      const clave = aBytes(CLAVE_PUBLICA)
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      // Si quedó una suscripción vieja hecha con OTRA clave, el navegador
      // rechaza crear la nueva y además esa vieja ya no sirve para nada: el
      // servidor firma con la de ahora y el celular la descarta en silencio.
      if (sub && !mismaClave(sub, clave)) {
        await sub.unsubscribe()
        sub = null
      }

      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: clave,
      })

      await guardar(sub)

      setEstado((p) => ({ ...p, suscripto: true, cargando: false, resultado: 'exito' }))
      log.info({ scope: 'push' }, 'avisos del celular activados')
      return true
    } catch (err) {
      log.error({ scope: 'push' }, `no se pudieron activar los avisos: ${String(err)}`)
      setEstado((p) => ({ ...p, cargando: false, resultado: 'error' }))
      return false
    }
  }, [uid, guardar])

  const desactivar = useCallback(async (): Promise<void> => {
    if (!soportado || !uid) return
    setEstado((p) => ({ ...p, cargando: true }))
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      const db = getDb()
      // Se borra el token para que el servidor deje de mandar a un teléfono
      // que ya no quiere saber nada.
      if (db) await setDoc(doc(db, `users/${uid}/config/push`), { token: null }, { merge: true })

      setEstado((p) => ({ ...p, suscripto: false, cargando: false }))
    } catch (err) {
      log.error({ scope: 'push' }, `no se pudieron apagar los avisos: ${String(err)}`)
      setEstado((p) => ({ ...p, cargando: false }))
    }
  }, [uid])

  // El cartelito de resultado no se queda pegado en pantalla para siempre.
  useEffect(() => {
    if (!estado.resultado) return
    const t = setTimeout(() => setEstado((p) => ({ ...p, resultado: null })), 6000)
    return () => clearTimeout(t)
  }, [estado.resultado])

  return {
    ...estado,
    soportado,
    /** Falta cargar la clave pública en el hosting: no es culpa de la persona. */
    faltaConfigurar: !CLAVE_PUBLICA,
    /** Activado de verdad: dio permiso Y hay una suscripción viva. */
    activado: estado.permiso === 'granted' && estado.suscripto,
    bloqueado: estado.permiso === 'denied',
    activar,
    desactivar,
  }
}
