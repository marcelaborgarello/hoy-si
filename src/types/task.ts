import { z } from 'zod'

/** Una nota suelta dentro de una tarea. Lo que se te va ocurriendo mientras la hacés. */
export const NoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number(),
})

export const StatusSchema = z.enum(['todo', 'doing', 'done'])

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: StatusSchema.default('todo'),
  /** Cuándo la anotaste. Sirve para saber cuánto la venís pateando. */
  createdAt: z.number(),
  /** Cuándo apretaste "Empecé". null = todavía no arrancó. */
  startedAt: z.number().nullable().default(null),
  /** Cuándo apretaste "Terminé". null = sigue abierta. */
  finishedAt: z.number().nullable().default(null),
  /** Fecha límite opcional, formato YYYY-MM-DD. */
  dueDate: z.string().nullable().default(null),
  /**
   * Hora límite opcional, formato HH:MM (24 h). Solo tiene sentido con dueDate.
   * El default null hace que las tareas viejas, guardadas antes de que esto
   * existiera, sigan entrando sin romper nada.
   */
  dueTime: z.string().nullable().default(null),
  notes: z.array(NoteSchema).default([]),
})

export type Note = z.infer<typeof NoteSchema>
export type Status = z.infer<typeof StatusSchema>
export type Task = z.infer<typeof TaskSchema>

/** Lo que hace falta para crear una tarea: el resto lo pone el store. */
export type NewTask = {
  title: string
  description?: string
  dueDate?: string | null
  dueTime?: string | null
}

/** Parsea una tarea que viene de afuera (localStorage o Firestore) sin romper la app. */
export function parseTask(raw: unknown): Task | null {
  const result = TaskSchema.safeParse(raw)
  return result.success ? result.data : null
}

export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parseTask).filter((t): t is Task => t !== null)
}
