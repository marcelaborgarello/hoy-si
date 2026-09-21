import type { Task } from '../types/task'
import { dayKey, daysUntilDue, dueMoment, todayKey } from './time'

export type Grupo = {
  key: string
  titulo: string
  /** Texto chico al lado del título: la fecha, o cuántas hay. */
  sub: string | null
  orden: number
  tasks: Task[]
}

const fmtDiaLargo = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const fmtCorto = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function desdeISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function mayus(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Posiciones fijas para que el orden de los bloques sea siempre el mismo.
 * Las fechas futuras se ubican entre MAÑANA y SIN_FECHA según cuántos días
 * falten, así la agenda queda cronológica sola.
 */
const POS = {
  EN_CURSO: 0,
  ATRASADAS: 1,
  HOY: 2,
  MANANA: 3,
  FUTURO: 10, // + días que faltan
  SIN_FECHA: 9000,
  HECHAS: 10000,
}

/**
 * Una tarea está "suelta" (sin agendar) si no tiene fecha y todavía no la
 * empezaste. Es la única regla que decide en cuál de las dos solapas se ve,
 * y vive acá para que no se escriba distinto en dos lados.
 *
 * Las dos excepciones son a propósito:
 * - **En curso**: lo que estás haciendo ahora va arriba de la agenda aunque no
 *   tenga fecha. Es el "una cosa por vez" del punto 1 de AGENTS.md.
 * - **Terminada**: se agrupa por el día en que la tachaste, que es una fecha.
 *   Así la lista de sin agendar queda limpia: solo lo que falta hacer.
 */
export function esSuelta(task: Task): boolean {
  return task.status === 'todo' && !task.dueDate
}

/** A qué bloque va cada tarea. */
function clasificar(task: Task, ahora: number): Omit<Grupo, 'tasks'> {
  if (task.status === 'done') {
    const día = task.finishedAt ? dayKey(task.finishedAt) : 'sin-fecha'
    const hoy = día === todayKey()
    return {
      key: `done-${día}`,
      titulo: hoy ? 'Terminadas hoy' : 'Terminadas',
      sub: hoy || !task.finishedAt ? null : mayus(fmtCorto.format(new Date(task.finishedAt))),
      orden: POS.HECHAS - (task.finishedAt ?? 0) / 1e10,
    }
  }

  // Lo que está en curso va siempre arriba de todo: es la que estás haciendo.
  if (task.status === 'doing') {
    return { key: 'en-curso', titulo: 'En curso', sub: null, orden: POS.EN_CURSO }
  }

  if (!task.dueDate) {
    return { key: 'sin-fecha', titulo: 'Sin fecha', sub: null, orden: POS.SIN_FECHA }
  }

  if (dueMoment(task.dueDate, task.dueTime) < ahora) {
    return { key: 'atrasadas', titulo: 'Se pasaron', sub: null, orden: POS.ATRASADAS }
  }

  const faltan = daysUntilDue(task.dueDate, ahora)
  const fecha = desdeISO(task.dueDate)

  if (faltan === 0) {
    return { key: task.dueDate, titulo: 'Hoy', sub: mayus(fmtCorto.format(fecha)), orden: POS.HOY }
  }
  if (faltan === 1) {
    return {
      key: task.dueDate,
      titulo: 'Mañana',
      sub: mayus(fmtCorto.format(fecha)),
      orden: POS.MANANA,
    }
  }
  return {
    key: task.dueDate,
    titulo: mayus(fmtDiaLargo.format(fecha)),
    sub: null,
    orden: POS.FUTURO + faltan,
  }
}

/** Dentro de un día: primero lo que tiene hora, en orden; el resto al final. */
function porHora(a: Task, b: Task): number {
  if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime)
  if (a.dueTime) return -1
  if (b.dueTime) return 1
  return a.createdAt - b.createdAt
}

/** Convierte la lista plana en bloques de agenda, listos para pintar. */
export function agrupar(tasks: Task[], ahora = Date.now()): Grupo[] {
  const mapa = new Map<string, Grupo>()

  for (const task of tasks) {
    const meta = clasificar(task, ahora)
    const grupo = mapa.get(meta.key) ?? { ...meta, tasks: [] }
    grupo.tasks.push(task)
    mapa.set(meta.key, grupo)
  }

  const grupos = [...mapa.values()]
  for (const g of grupos) {
    g.tasks.sort(g.key.startsWith('done-') ? (a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0) : porHora)
  }

  return grupos.sort((a, b) => a.orden - b.orden)
}
