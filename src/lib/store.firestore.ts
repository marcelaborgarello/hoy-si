import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { parseTask, type NewTask, type Task } from '../types/task'
import { buildTask } from './factory'
import { getDb } from './firebase'
import type { TaskStore } from './store'

/**
 * Firestore en tiempo real: onSnapshot deja la lista sincronizada sola,
 * en todos los dispositivos donde tengas la app abierta.
 *
 * Todo cuelga de /users/{uid}/tasks. Las reglas solo dejan entrar si
 * request.auth.uid coincide con ese {uid}, y eso lo valida Google en su
 * servidor: no se puede falsear desde el navegador.
 */
export function createFirestoreStore(uid: string): TaskStore {
  const db = getDb()
  if (!db) throw new Error('Firestore pedido pero sin configurar')

  const path = `users/${uid}/tasks`
  const tasksRef = collection(db, path)

  return {
    subscribe(onChange, onError) {
      const q = query(tasksRef, orderBy('createdAt', 'desc'))
      return onSnapshot(
        q,
        (snap) => {
          const tasks = snap.docs
            .map((d) => parseTask({ id: d.id, ...d.data() }))
            .filter((t): t is Task => t !== null)
          onChange(tasks)
        },
        (err) => {
          console.error('[firestore] error escuchando tareas:', err)
          onError?.(err)
        },
      )
    },
    async create(input: NewTask) {
      await addDoc(tasksRef, buildTask(input))
    },
    async update(id, patch) {
      await updateDoc(doc(db, path, id), patch)
    },
    async remove(id) {
      await deleteDoc(doc(db, path, id))
    },
  }
}
