import type { NewTask, Task } from '../types/task'

export function newId(): string {
  return crypto.randomUUID()
}

/** Arma una tarea nueva completa a partir del input mínimo del formulario. */
export function buildTask(input: NewTask): Omit<Task, 'id'> {
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: 'todo',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueDate ? (input.dueTime ?? null) : null,
    notes: [],
  }
}
