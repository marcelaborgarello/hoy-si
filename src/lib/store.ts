import type { NewTask, Task } from '../types/task'
import { isFirebaseConfigured } from './firebase'
import { createLocalStore } from './store.local'
import { createFirestoreStore } from './store.firestore'

/**
 * Contrato único de persistencia. La UI no sabe (ni le importa) si atrás
 * hay localStorage o Firestore.
 */
export interface TaskStore {
  /**
   * Se suscribe a la lista completa. Devuelve la función para desuscribirse.
   * `onError` avisa si el backend rechaza la lectura (ej: reglas de Firestore),
   * para que la UI no quede colgada en "Cargando…".
   */
  subscribe(onChange: (tasks: Task[]) => void, onError?: (err: Error) => void): () => void
  create(input: NewTask): Promise<void>
  update(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void>
  remove(id: string): Promise<void>
}

export type Backend = 'firestore' | 'local'

/**
 * El store se crea POR USUARIO: las tareas viven en /users/{uid}/tasks, que es
 * exactamente el camino que autorizan las reglas de seguridad.
 * Sin uid (o sin Firebase configurado) se cae a localStorage.
 */
export function createStore(uid: string | null): { store: TaskStore; backend: Backend } {
  if (isFirebaseConfigured && uid) {
    try {
      return { store: createFirestoreStore(uid), backend: 'firestore' }
    } catch (err) {
      // Si Firestore no arranca, no dejamos al usuario sin app.
      console.error('[store] Firestore falló, uso localStorage:', err)
    }
  }
  return { store: createLocalStore(), backend: 'local' }
}
