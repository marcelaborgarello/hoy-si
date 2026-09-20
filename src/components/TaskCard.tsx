import type { Task } from '../types/task'
import { daysSince, dueMoment, formatDueDate, formatDuration, dueStatus } from '../lib/time'
import { AvisosMini } from './AvisosMini'

type Props = {
  task: Task
  onToggle: (task: Task) => void
  onStart: (task: Task) => void
  onOpen: (task: Task) => void
  telegramConectado: boolean
}

/** Etiquetas de contexto: cuánto la venís pateando, si vence, cuánto tardó. */
function metaPills(task: Task) {
  const pills: { text: string; tone?: 'hot' | 'late' | 'ok' }[] = []

  if (task.status === 'done' && task.startedAt && task.finishedAt) {
    pills.push({ text: `⏱ te llevó ${formatDuration(task.finishedAt - task.startedAt)}`, tone: 'ok' })
  } else {
    const esperando = daysSince(task.createdAt)
    if (esperando >= 1) {
      pills.push({
        text: `esperando ${esperando} ${esperando === 1 ? 'día' : 'días'}`,
        tone: esperando >= 7 ? 'hot' : undefined,
      })
    }
  }

  if (task.status === 'doing' && task.startedAt) {
    pills.push({ text: `▶ en curso hace ${formatDuration(Date.now() - task.startedAt)}` })
  }

  if (task.dueDate && task.status !== 'done') {
    // Rojo solo si de verdad se pasó. "Para hoy" no es estar en falta.
    const { text, late } = dueStatus(task.dueDate, task.dueTime)
    pills.push({ text: `📅 ${text}`, tone: late ? 'late' : undefined })
  } else if (task.dueDate) {
    pills.push({
      text: `📅 ${formatDueDate(task.dueDate)}${task.dueTime ? ` ${task.dueTime}` : ''}`,
    })
  }

  if (task.notes.length > 0) {
    pills.push({ text: `📝 ${task.notes.length}` })
  }

  return pills
}

export function TaskCard({ task, onToggle, onStart, onOpen, telegramConectado }: Props) {
  const vencida =
    task.dueDate !== null &&
    task.status !== 'done' &&
    dueMoment(task.dueDate, task.dueTime) < Date.now()

  const className = [
    'card',
    task.status === 'doing' && 'is-doing',
    task.status === 'done' && 'is-done',
    vencida && 'is-late',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={className}>
      <button
        className={`tick${task.status === 'done' ? ' on' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.status === 'done' ? 'Volver a abrir' : 'Marcar como terminada'}
        title={task.status === 'done' ? 'Volver a abrir' : 'Terminé'}
      >
        ✓
      </button>

      <div
        className="card-body"
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(task)
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-title">{task.title}</div>
        {task.description && <div className="card-desc">{task.description}</div>}
        <div className="meta">
          {metaPills(task).map((p) => (
            <span key={p.text} className={`pill${p.tone ? ` ${p.tone}` : ''}`}>
              {p.text}
            </span>
          ))}
        </div>
      </div>

      <div className="card-actions">
        {/* Los avisos se ven acá, en la tarjeta: no hay que abrir el detalle
            para saber si esta tarea te va a avisar o no. */}
        {task.status !== 'done' && (
          <AvisosMini task={task} telegramConectado={telegramConectado} />
        )}

        {task.status === 'todo' && (
          <button className="btn sm" onClick={() => onStart(task)}>
            Empecé
          </button>
        )}
        <button className="btn ghost sm" onClick={() => onOpen(task)} title="Ver detalle y notas">
          ⋯
        </button>
      </div>
    </article>
  )
}
