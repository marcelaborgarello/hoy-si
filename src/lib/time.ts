const DAY = 86_400_000

const fmtDateTime = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const fmtDate = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDateTime(ts: number): string {
  return fmtDateTime.format(new Date(ts))
}

/** Toma un 'YYYY-MM-DD' y lo muestra lindo, sin que el huso horario lo corra un día. */
export function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return fmtDate.format(new Date(y, m - 1, d))
}

/** 'HH:MM' tal cual, listo para mostrar. */
export function formatHora(hhmm: string): string {
  return hhmm
}

/** Duración en lenguaje humano: "45 min", "2 h 15 min", "3 días". */
export function formatDuration(ms: number): string {
  if (ms < 0) return '—'
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'menos de un minuto'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`
  const d = Math.floor(h / 24)
  const restH = h % 24
  return restH ? `${d} ${d === 1 ? 'día' : 'días'} ${restH} h` : `${d} ${d === 1 ? 'día' : 'días'}`
}

/** Días completos transcurridos desde un timestamp. */
export function daysSince(ts: number, now = Date.now()): number {
  return Math.floor((now - ts) / DAY)
}

/** Clave YYYY-MM-DD en hora local, para agrupar por día. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayKey(): string {
  return dayKey(Date.now())
}

/**
 * Momento exacto del límite. Sin hora, se toma el final del día: una tarea
 * "para hoy" no está atrasada a las 9 de la mañana.
 */
export function dueMoment(iso: string, time: string | null): number {
  const [y, m, d] = iso.split('-').map(Number)
  if (time) {
    const [h, min] = time.split(':').map(Number)
    return new Date(y, m - 1, d, h, min, 0, 0).getTime()
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

/** Texto para mostrar el límite, y si ya se pasó. */
export function dueStatus(
  iso: string,
  time: string | null,
  now = Date.now(),
): { text: string; late: boolean } {
  const momento = dueMoment(iso, time)
  const dias = daysUntilDue(iso, now)
  const hora = time ? ` ${time}` : ''

  if (momento < now) {
    // Con hora podemos ser precisos el mismo día.
    if (dias === 0 && time) return { text: `se pasó a las ${time}`, late: true }
    const d = Math.abs(dias)
    return { text: `se pasó hace ${d} ${d === 1 ? 'día' : 'días'}`, late: true }
  }

  if (dias === 0) return { text: `para hoy${hora}`, late: false }
  if (dias === 1) return { text: `para mañana${hora}`, late: false }
  return { text: `para dentro de ${dias} días${hora}`, late: false }
}

/** Días que faltan para una fecha límite. Negativo = vencida. */
export function daysUntilDue(iso: string, now = Date.now()): number {
  const [y, m, d] = iso.split('-').map(Number)
  const due = new Date(y, m - 1, d).getTime()
  const today = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime()
  return Math.round((due - today) / DAY)
}
