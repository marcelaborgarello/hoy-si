import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import { newId } from '../lib/factory'
import { log } from '../lib/logger'

export type Config = {
  /** Chat de Telegram vinculado. Lo escribe el servidor, no el navegador. */
  telegramChatId: string | null
  avisos: boolean
}

/** El nombre elegido. Vacío = se usa el que trae Google. */
export type Perfil = { nombre: string }

const VACIA: Config = { telegramChatId: null, avisos: false }

const BOT = 'hoysi_tareas_bot'

/**
 * Preferencias de avisos de la persona. Escucha en vivo: cuando el bot
 * engancha el chat del lado del servidor, la pantalla se actualiza sola sin
 * que haya que recargar.
 */
export function useConfig(uid: string | null) {
  const [config, setConfig] = useState<Config>(VACIA)
  const [nombre, setNombreLocal] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const db = getDb()
    if (!db || !uid) {
      // Este setState es aceptable: estamos sincronizando con un sistema externo (Firestore).
      setCargando(false)
      return
    }
    return onSnapshot(
      doc(db, `users/${uid}/config/avisos`),
      (snap) => {
        setConfig({ ...VACIA, ...(snap.data() as Partial<Config> | undefined) })
        setCargando(false)
      },
      (err) => {
        log.error({ scope: 'config' }, `no se pudo leer la configuracion: ${err.message}`)
        setCargando(false)
      },
    )
  }, [uid])

  // El nombre vive en su propio documento (ver firestore.rules).
  useEffect(() => {
    const db = getDb()
    if (!db || !uid) return
    return onSnapshot(
      doc(db, `users/${uid}/config/perfil`),
      (snap) => setNombreLocal((snap.data() as Perfil | undefined)?.nombre ?? ''),
      (err) => log.error({ scope: 'config' }, `no se pudo leer el perfil: ${err.message}`),
    )
  }, [uid])

  const guardarNombre = useCallback(
    async (valor: string) => {
      const db = getDb()
      if (!db || !uid) return
      await setDoc(doc(db, `users/${uid}/config/perfil`), { nombre: valor.trim().slice(0, 60) })
    },
    [uid],
  )

  /**
   * Genera un código de un solo uso y devuelve el link que abre el bot ya
   * con ese código adentro. Así la persona no copia ni pega nada: toca el
   * botón, toca «Empezar» en Telegram, y queda conectada.
   */
  const crearLinkDeConexion = useCallback(async (): Promise<string | null> => {
    const db = getDb()
    if (!db || !uid) return null
    const codigo = newId().replace(/-/g, '').slice(0, 20)
    try {
      await setDoc(doc(db, 'vinculos', codigo), { uid, creadoEn: Date.now() })
      return `https://t.me/${BOT}?start=${codigo}`
    } catch (err) {
      log.error({ scope: 'config' }, `no se pudo crear el codigo: ${String(err)}`)
      return null
    }
  }, [uid])

  const desconectar = useCallback(async () => {
    const db = getDb()
    if (!db || !uid) return
    // Las reglas no dejan que el navegador escriba un chat, solo borrarlo.
    await setDoc(doc(db, `users/${uid}/config/avisos`), { telegramChatId: null, avisos: false })
  }, [uid])

  return { config, nombre, guardarNombre, cargando, crearLinkDeConexion, desconectar }
}
