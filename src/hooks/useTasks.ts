import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NewTask, Note, Task } from '../types/task'
import { momentoDeLaTarea, proximoAviso } from '../lib/alertas'
import { newId } from '../lib/factory'
import { log } from '../lib/logger'
import { createStore } from '../lib/store'

type Aviso = { text: string; hint: string | null }

/**
 * Única fuente de verdad de la UI. Se suscribe al store (la nube o esta
 * computadora) y expone las acciones con la lógica de fechas ya resuelta.
 *
 * El store se recrea si cambia el uid: al cerrar sesión y entrar con otra
 * cuenta, las tareas de la anterior no se filtran.
 */
export function useTasks(uid: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * Si la nube rechaza la conexión, seguimos guardando en esta computadora en
   * vez de dejar la app inservible. Se recuerda por uid para no reintentar en
   * loop, y se limpia solo al cambiar de cuenta.
   */
  const [modoLocalPara, setModoLocalPara] = useState<string | null>(null)
  const enModoLocal = uid !== null && modoLocalPara === uid

  /** Aviso de que estamos guardando local. `hint` solo se ve en desarrollo. */
  const [aviso, setAviso] = useState<Aviso | null>(null)
  /** Cuando una escritura puntual falla. Nunca fallar en silencio. */
  const [writeError, setWriteError] = useState<string | null>(null)

  const { store, backend } = useMemo(
    () => createStore(enModoLocal ? null : uid),
    [uid, enModoLocal],
  )

  useEffect(() => {
    setTasks([])
    setLoading(true)
    return store.subscribe(
      (next) => {
        setTasks(next)
        setLoading(false)
      },
      (err) => {
        // Nunca dejar la pantalla colgada en "Cargando…" ni perder lo que
        // escriba: pasamos a guardar en esta computadora y lo avisamos.
        log.error({ scope: 'store' }, `la nube rechazo la conexion: ${err.message}`)
        setAviso({
          text: 'No me pude conectar a la nube, así que guardo todo en esta compu. Tus cosas están a salvo, pero no las vas a ver en el celular.',
          hint: import.meta.env.DEV
            ? err.message.includes('insufficient permissions')
              ? 'Faltan las reglas. Corré: bun run fb:login  y despues  bun run rules'
              : err.message
            : null,
        })
        if (uid) setModoLocalPara(uid)
        setLoading(false)
      },
    )
  }, [store, uid])

  const byId = useCallback((id: string) => tasks.find((t) => t.id === id) ?? null, [tasks])

  /**
   * Envuelve toda escritura: si falla, lo decimos en pantalla en vez de que
   * la acción se pierda sin explicación. Devuelve si salió bien.
   */
  const run = useCallback(async (p: Promise<void>): Promise<boolean> => {
    try {
      await p
      setWriteError(null)
      return true
    } catch (err) {
      log.error({ scope: 'store' }, `no se pudo guardar: ${(err as Error).message}`)
      setWriteError('No se pudo guardar eso. Fijate que tengas internet y probá de nuevo.')
      return false
    }
  }, [])

  /**
   * Toda escritura pasa por acá, y acá se recalcula cuándo toca el próximo
   * aviso. Así no hay forma de cambiar la hora, apagar el aviso o tachar la
   * tarea y que quede un aviso viejo dando vueltas.
   */
  const guardar = useCallback(
    (task: Task, patch: Partial<Omit<Task, 'id'>>) => {
      const resultado = { ...task, ...patch }
      return run(
        store.update(task.id, {
          ...patch,
          // El horario resuelto lo calcula acá el navegador, que conoce la
          // zona. El servidor corre en UTC y no puede hacerlo (ver task.ts).
          dueAt: momentoDeLaTarea(resultado),
          nextNotifyAt: proximoAviso(resultado),
        }),
      )
    },
    [store, run],
  )

  const actions = useMemo(
    () => ({
      add: (input: NewTask) => run(store.create(input)),

      /** Sella el arranque. Si ya había arrancado antes, respeta la fecha original. */
      start: (task: Task) =>
        guardar(task, { status: 'doing', startedAt: task.startedAt ?? Date.now() }),

      /** Tachar. Si nunca la arrancaste, cuenta como que empezó y terminó ahora. */
      finish: (task: Task) => {
        const now = Date.now()
        // Al terminarla, proximoAviso() devuelve null: no te avisa de algo hecho.
        return guardar(task, {
          status: 'done',
          startedAt: task.startedAt ?? now,
          finishedAt: now,
        })
      },

      /** Volver a abrir algo tachado (pasa a "en curso" y borra el fin). */
      reopen: (task: Task) => guardar(task, { status: 'doing', finishedAt: null }),

      /** Devolver a pendiente y limpiar los relojes. */
      reset: (task: Task) =>
        guardar(task, { status: 'todo', startedAt: null, finishedAt: null }),

      edit: (task: Task, patch: Partial<Omit<Task, 'id'>>) => guardar(task, patch),

      /**
       * Guarda los dos avisos de una tarea. Son independientes: se puede
       * querer solo el anticipado, solo el de la hora, o los dos.
       *
       * Destildar los dos apaga el aviso; no hace falta una acción aparte
       * para eso.
       */
      cambiarAvisos: (
        task: Task,
        patch: { notifyAtTime: boolean; notifyBeforeMin: number | null },
      ) =>
        guardar(task, {
          ...patch,
          notify: patch.notifyAtTime || patch.notifyBeforeMin !== null,
        }),

      remove: (id: string) => run(store.remove(id)),

      addNote: (task: Task, text: string) => {
        const note: Note = { id: newId(), text: text.trim(), createdAt: Date.now() }
        return run(store.update(task.id, { notes: [...task.notes, note] }))
      },

      removeNote: (task: Task, noteId: string) =>
        run(store.update(task.id, { notes: task.notes.filter((n) => n.id !== noteId) })),
    }),
    [store, run, guardar],
  )

  return { tasks, loading, aviso, writeError, backend, byId, ...actions }
}
