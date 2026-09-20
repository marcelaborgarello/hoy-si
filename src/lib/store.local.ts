import { parseTasks, type NewTask, type Task } from '../types/task'
import { buildTask, newId } from './factory'
import type { TaskStore } from './store'

const KEY = 'todo-list:tasks:v1'

/**
 * Respaldo en localStorage. Se usa cuando no hay config de Firebase,
 * así la app nunca queda inutilizable por falta de credenciales.
 */
export function createLocalStore(): TaskStore {
  const listeners = new Set<(tasks: Task[]) => void>()

  const read = (): Task[] => {
    try {
      return parseTasks(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    } catch {
      return []
    }
  }

  const emit = (tasks: Task[]) => {
    for (const l of listeners) l(tasks)
  }

  const write = (tasks: Task[]) => {
    localStorage.setItem(KEY, JSON.stringify(tasks))
    emit(tasks)
  }

  // Si tenés la app abierta en dos pestañas, que se sincronicen.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) emit(read())
  })

  return {
    subscribe(onChange) {
      listeners.add(onChange)
      onChange(read())
      return () => {
        listeners.delete(onChange)
      }
    },
    async create(input: NewTask) {
      write([{ id: newId(), ...buildTask(input) }, ...read()])
    },
    async update(id, patch) {
      write(read().map((t) => (t.id === id ? { ...t, ...patch } : t)))
    },
    async remove(id) {
      write(read().filter((t) => t.id !== id))
    },
  }
}
