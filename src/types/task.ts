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
  /**
   * Si esta tarea avisa por Telegram. Es el interruptor general.
   *
   * Arranca APAGADO a propósito: tener hora significa que está agendada, no
   * que quieras que te suene el teléfono. Muchas veces se agenda algo solo
   * para revisarlo.
   *
   * Queda en `false` solo cuando NO hay ningún aviso elegido, o sea cuando
   * `notifyAtTime` es false y `notifyBeforeMin` es null.
   */
  notify: z.boolean().default(false),
  /**
   * Avisar en el horario exacto de la tarea.
   *
   * Es independiente del aviso anticipado: se puede querer solo el de antes
   * —algo que hay que preparar media hora antes, y a la hora ya no sirve que
   * suene— o solo el de la hora, o los dos.
   *
   * Default `true` para que las tareas que ya tenían aviso sigan igual.
   */
  notifyAtTime: z.boolean().default(true),
  /**
   * Minutos de anticipación del aviso previo. null = no hay aviso previo.
   * Lo elige la persona por tarea, porque un turno médico y sacar la basura
   * no se avisan con la misma anticipación.
   */
  notifyBeforeMin: z.number().nullable().default(null),
  /**
   * El horario de la tarea resuelto a un momento absoluto (epoch ms).
   *
   * ⚠️ Existe porque el servidor corre en UTC y el navegador en la zona de
   * quien usa la app. Si el servidor hiciera `new Date(año, mes, día, hora)`
   * con `dueDate` y `dueTime`, entendería "15:36" como 15:36 UTC y se
   * equivocaría por las horas de diferencia que haya.
   *
   * Lo calcula el navegador, que es el único que conoce la zona correcta, y
   * el servidor solo compara números. **En `api/` no se arma ninguna fecha a
   * partir de `dueDate`/`dueTime`.**
   */
  dueAt: z.number().nullable().default(null),
  /**
   * Momento exacto (epoch ms) del PRÓXIMO aviso pendiente. null = no hay.
   *
   * Existe para que el servidor pueda preguntar "¿qué avisos tocan ahora?" con
   * una sola consulta, en vez de recorrer todas las tareas y calcular horarios.
   * Lo recalcula el cliente cada vez que cambia algo que lo afecte, y el
   * servidor lo avanza al siguiente aviso cuando manda uno.
   */
  nextNotifyAt: z.number().nullable().default(null),
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
  notify?: boolean
  notifyAtTime?: boolean
  notifyBeforeMin?: number | null
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
