import type { Task } from '../types/task'
import { dayKey, daysSince, todayKey } from './time'

export type Stats = {
  total: number
  pending: number
  doing: number
  done: number
  doneToday: number
  /** Días seguidos terminando al menos una tarea. */
  streak: number
  /** La tarea abierta más vieja: la que más venís pateando. */
  oldestPending: Task | null
}

export function computeStats(tasks: Task[], now = Date.now()): Stats {
  const done = tasks.filter((t) => t.status === 'done')
  const doing = tasks.filter((t) => t.status === 'doing')
  const pending = tasks.filter((t) => t.status === 'todo')

  const finishedAt = done
    .map((t) => t.finishedAt)
    .filter((ts): ts is number => ts !== null)

  const finishedDays = new Set(finishedAt.map(dayKey))
  const hoy = todayKey()

  const open = [...pending, ...doing]
  const oldestPending = open.length
    ? open.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b))
    : null

  return {
    total: tasks.length,
    pending: pending.length,
    doing: doing.length,
    done: done.length,
    doneToday: finishedAt.filter((ts) => dayKey(ts) === hoy).length,
    streak: computeStreak(finishedDays, now),
    oldestPending,
  }
}

/**
 * Cuenta días consecutivos con al menos una tarea terminada.
 * Arranca desde hoy; si hoy todavía no hiciste nada, arranca desde ayer
 * (la racha sigue viva hasta que termine el día).
 */
function computeStreak(finishedDays: Set<string>, now: number): number {
  const DAY = 86_400_000
  let cursor = now
  if (!finishedDays.has(dayKey(cursor))) {
    cursor -= DAY
    if (!finishedDays.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (finishedDays.has(dayKey(cursor))) {
    streak++
    cursor -= DAY
  }
  return streak
}

const CELEBRACIONES = [
  '¡Listo! Una menos dando vueltas en la cabeza.',
  'Hecho. Tu yo de la mañana no lo podía creer.',
  '✔ Tachada. Eso no se procrastina más.',
  '¡Salió! Y no fue tan terrible, ¿no?',
  'Terminada. Ahí tenés la prueba de que podés.',
]

/** Mensaje para el momento de tachar: reconoce el esfuerzo real. */
export function celebrationMessage(task: Task, now = Date.now()): string {
  const esperando = daysSince(task.createdAt, now)
  if (esperando >= 7) {
    return `¡${esperando} días esperando y la hiciste! Esa era la difícil.`
  }
  if (task.startedAt && now - task.startedAt < 10 * 60_000) {
    return 'En menos de 10 minutos. Lo que costaba era empezar.'
  }
  return CELEBRACIONES[Math.floor(Math.random() * CELEBRACIONES.length)]
}

/** Empujón según el estado general del tablero. */
export function nudge(stats: Stats): string {
  if (stats.total === 0) return 'Tablero limpio. Anotá una cosa chiquita para arrancar.'
  if (stats.doing > 0) return 'Tenés algo en curso. Terminá eso antes de agarrar otra.'
  if (stats.doneToday > 0) return `${stats.doneToday} hoy. Cerrá una más y la racha sube.`
  if (stats.oldestPending) {
    const d = daysSince(stats.oldestPending.createdAt)
    if (d >= 3) return `«${stats.oldestPending.title}» lleva ${d} días esperando. Dale 5 minutos.`
  }
  return 'Elegí una y apretá Empecé. Con eso alcanza.'
}
