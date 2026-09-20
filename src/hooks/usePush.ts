import { useState, useEffect } from 'react'
import { log } from '../lib/logger'

type PushState = {
  soportado: boolean
  permiso: NotificationPermission
  token: string | null
  cargando: boolean
  ultimoResultado: 'exito' | 'error' | null
}

/**
 * Hook para manejar notificaciones push web.
 *
 * Permite pedir permisos al usuario y obtener el token de FCM
 * para recibir notificaciones personalizadas con sonido.
 */
export function usePush(uid: string | null) {
  const [estado, setEstado] = useState<PushState>({
    soportado: 'serviceWorker' in navigator && 'PushManager' in window,
    permiso: 'default',
    token: localStorage.getItem('push-token'),
    cargando: false,
    ultimoResultado: null,
  })

  useEffect(() => {
    // Este efecto está bien: estamos sincronizando con el sistema externo (navegador)
    setEstado((prev) => ({ ...prev, permiso: Notification.permission }))
  }, [])

  const pedirPermiso = async (): Promise<boolean> => {
    if (!estado.soportado || !uid) return false

    try {
      const permiso = await Notification.requestPermission()
      setEstado((prev) => ({ ...prev, permiso }))

      if (permiso === 'granted') {
        await suscribir()
        setEstado((prev) => ({ ...prev, ultimoResultado: 'exito' }))
        return true
      }
      setEstado((prev) => ({ ...prev, ultimoResultado: 'error' }))
      return false
    } catch (err) {
      log.error({ scope: 'push' }, `error al pedir permiso: ${String(err)}`)
      setEstado((prev) => ({ ...prev, ultimoResultado: 'error' }))
      return false
    }
  }

  const suscribir = async (): Promise<void> => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      })

      const token = JSON.stringify(subscription)
      localStorage.setItem('push-token', token)
      setEstado((prev) => ({ ...prev, token }))

      // Enviar el token al servidor
      await fetch('/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token }),
      })

      log.info({ scope: 'push' }, 'suscrito a notificaciones push')
    } catch (err) {
      log.error({ scope: 'push' }, `error al suscribir: ${String(err)}`)
      throw err
    }
  }

  // Limpiar el resultado después de 5 segundos
  useEffect(() => {
    if (estado.ultimoResultado) {
      const timer = setTimeout(() => {
        setEstado((prev) => ({ ...prev, ultimoResultado: null }))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [estado.ultimoResultado])

  return {
    ...estado,
    pedirPermiso,
    puedePedir: estado.soportado && estado.permiso === 'default',
    habilitado: estado.permiso === 'granted',
    resultado: estado.ultimoResultado,
  }
}
