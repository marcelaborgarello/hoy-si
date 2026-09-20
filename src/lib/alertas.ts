import type { Task } from '../types/task'
import { dueMoment } from './time'

/** Cuánto dura el evento que se crea en el calendario. */
const DURACION_MIN = 30

/** Formato que pide Google Calendar: 20260921T100000Z */
function aFormatoGoogle(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Link que abre Google Calendar con el evento ya cargado. No usa la API ni
 * pide permisos sobre el calendario: la persona confirma en la pantalla de
 * Google y el recordatorio se lo maneja Calendar.
 *
 * Devuelve null si la tarea no tiene hora: un evento de calendario sin
 * horario no sirve para que te avisen.
 */
export function linkGoogleCalendar(task: Task): string | null {
  if (!task.dueDate || !task.dueTime) return null

  const inicio = dueMoment(task.dueDate, task.dueTime)
  const fin = inicio + DURACION_MIN * 60_000

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${aFormatoGoogle(inicio)}/${aFormatoGoogle(fin)}`,
  })

  if (task.description) params.set('details', task.description)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Una tarea solo puede tener alertas si tiene día Y hora. */
export function puedeTenerAlerta(task: Task): boolean {
  return Boolean(task.dueDate && task.dueTime)
}
