import type { NewTask, Task } from '../types/task'
import { proximoAviso } from './alertas'

export function newId(): string {
  return crypto.randomUUID()
}

/** Arma una tarea nueva completa a partir del input mínimo del formulario. */
export function buildTask(input: NewTask): Omit<Task, 'id'> {
  const base = {
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: 'todo' as const,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueDate ? (input.dueTime ?? null) : null,
    // Sin hora no puede haber aviso, así que ni se enciende.
    notify: Boolean(input.dueTime) && (input.notify ?? false),
    notifyAtTime: input.notifyAtTime ?? true,
    notifyBeforeMin: input.notifyBeforeMin ?? null,
    notes: [],
  } satisfies Omit<Task, 'id' | 'nextNotifyAt'>

  // El momento del próximo aviso se guarda junto con la tarea: es lo que el
  // servidor consulta para saber a quién avisarle.
  return { ...base, nextNotifyAt: proximoAviso(base) }
}
