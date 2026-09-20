import { useEffect, useRef, useState } from 'react'
import type { Task } from '../types/task'
import { linkGoogleCalendar, puedeTenerAlerta } from '../lib/alertas'
import { daysSince, formatDateTime, formatDueDate, formatDuration, todayKey } from '../lib/time'

type Props = {
  task: Task
  onClose: () => void
  onEdit: (id: string, patch: Partial<Omit<Task, 'id'>>) => void
  onStart: (task: Task) => void
  onFinish: (task: Task) => void
  onReset: (task: Task) => void
  onRemove: (id: string) => void
  onAddNote: (task: Task, text: string) => void
  onRemoveNote: (task: Task, noteId: string) => void
}

export function TaskDetail({
  task,
  onClose,
  onEdit,
  onStart,
  onFinish,
  onReset,
  onRemove,
  onAddNote,
  onRemoveNote,
}: Props) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [noteText, setNoteText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Si cambia la tarea abierta (o llega una actualización de Firestore), resincronizar.
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
    setConfirmDelete(false)
  }, [task.id, task.title, task.description])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const linkCalendar = linkGoogleCalendar(task)
  const sinHora = !puedeTenerAlerta(task)

  const saveTitle = () => {
    const clean = title.trim()
    if (clean && clean !== task.title) onEdit(task.id, { title: clean })
    else if (!clean) setTitle(task.title)
  }

  const saveDescription = () => {
    if (description !== task.description) onEdit(task.id, { description })
  }

  const submitNote = () => {
    if (!noteText.trim()) return
    onAddNote(task, noteText)
    setNoteText('')
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        className="panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Detalle de la tarea"
      >
        <header className="panel-head">
          <textarea
            className="panel-title"
            rows={Math.max(1, Math.ceil(title.length / 34))}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            aria-label="Título"
          />
          <button className="btn ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="panel-body">
          <section className="section">
            <h3>Descripción</h3>
            <textarea
              className="desc-edit"
              placeholder="¿Qué hay que hacer exactamente? Escribilo chiquito, así arranca más fácil."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
            />
          </section>

          <section className="section">
            <h3>Fechas</h3>
            <div className="timeline">
              <div className="tl-row">
                <span className="k">Anotada</span>
                <span className="v">
                  {formatDateTime(task.createdAt)}
                  {task.status !== 'done' && daysSince(task.createdAt) >= 1 && (
                    <> · hace {daysSince(task.createdAt)} d</>
                  )}
                </span>
              </div>
              <div className="tl-row">
                <span className="k">Empecé</span>
                <span className="v">
                  {task.startedAt ? formatDateTime(task.startedAt) : '— todavía no'}
                </span>
              </div>
              <div className="tl-row">
                <span className="k">Terminé</span>
                <span className="v">
                  {task.finishedAt ? formatDateTime(task.finishedAt) : '— todavía no'}
                </span>
              </div>
              <div className="tl-row">
                <span className="k">Para cuándo</span>
                <span className="v">
                  <input
                    type="date"
                    className={`dt${task.dueDate ? '' : ' vacio'}`}
                    value={task.dueDate ?? ''}
                    onChange={(e) =>
                      // Sin fecha no puede quedar una hora colgada.
                      onEdit(task.id, {
                        dueDate: e.target.value || null,
                        ...(e.target.value ? {} : { dueTime: null }),
                      })
                    }
                    aria-label="Fecha límite"
                  />
                </span>
              </div>
              {/* Fila propia y SIEMPRE visible: escondida detrás de la fecha,
                  no había forma de descubrir que se podía poner hora. */}
              <div className="tl-row">
                <span className="k">A qué hora</span>
                <span className="v">
                  {!task.dueTime && (
                    <span style={{ color: 'var(--text-faint)', fontSize: 12, marginRight: 8 }}>
                      sin hora = todo el día
                    </span>
                  )}
                  <input
                    type="time"
                    className={`dt${task.dueTime ? '' : ' vacio'}`}
                    value={task.dueTime ?? ''}
                    onChange={(e) =>
                      onEdit(task.id, {
                        dueTime: e.target.value || null,
                        // Poner hora sin día asume hoy.
                        ...(e.target.value && !task.dueDate ? { dueDate: todayKey() } : {}),
                      })
                    }
                    aria-label="Hora límite"
                  />
                </span>
              </div>
              {task.startedAt && task.finishedAt && (
                <div className="tl-row total">
                  <span className="k">Tiempo real</span>
                  <span className="v">{formatDuration(task.finishedAt - task.startedAt)}</span>
                </div>
              )}
            </div>
            {task.dueDate && task.status === 'done' && (
              <p style={{ color: 'var(--text-faint)', fontSize: 12, margin: '8px 0 0' }}>
                Era para el {formatDueDate(task.dueDate)}.
              </p>
            )}
          </section>

          <section className="section">
            <h3>Avisame</h3>
            {/* Sin hora no hay alerta posible, y hay que explicar por qué en vez
                de mostrar un botón que no hace nada. */}
            <div
              className="alertas"
              data-tip={
                sinHora ? 'Para que te avise, primero ponele una hora acá arriba' : undefined
              }
            >
              <a
                className={`btn alerta${sinHora ? ' off' : ''}`}
                href={linkCalendar ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={sinHora}
                onClick={(e) => {
                  if (sinHora) e.preventDefault()
                }}
              >
                📅 Google Calendar
              </a>

              <button
                className="btn alerta off"
                type="button"
                disabled
                data-tip="Todavía no está conectado Telegram"
              >
                ✈️ Telegram
              </button>
            </div>
          </section>

          <section className="section">
            <h3>Notas ({task.notes.length})</h3>
            {task.notes.length > 0 && (
              <div className="notes">
                {task.notes.map((n) => (
                  <div className="note" key={n.id}>
                    <div>
                      <p>{n.text}</p>
                      <div className="when">{formatDateTime(n.createdAt)}</div>
                    </div>
                    <button
                      className="btn ghost sm"
                      onClick={() => onRemoveNote(task, n.id)}
                      aria-label="Borrar nota"
                      title="Borrar nota"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="note-form">
              <textarea
                placeholder="Anotá algo… (Ctrl+Enter para guardar)"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    submitNote()
                  }
                }}
                aria-label="Nueva nota"
              />
              <button className="btn" onClick={submitNote} disabled={!noteText.trim()}>
                Agregar
              </button>
            </div>
          </section>
        </div>

        <footer className="panel-foot">
          <div style={{ display: 'flex', gap: 8 }}>
            {task.status === 'todo' && (
              <button className="btn primary" onClick={() => onStart(task)}>
                Empecé
              </button>
            )}
            {task.status === 'doing' && (
              <button className="btn primary" onClick={() => onFinish(task)}>
                Terminé
              </button>
            )}
            {task.status === 'done' && (
              <button className="btn" onClick={() => onReset(task)}>
                Reabrir
              </button>
            )}
          </div>

          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>¿Seguro?</span>
              <button
                className="btn sm danger"
                onClick={() => {
                  onRemove(task.id)
                  onClose()
                }}
              >
                Borrar
              </button>
              <button className="btn ghost sm" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button className="btn ghost sm danger" onClick={() => setConfirmDelete(true)}>
              Borrar tarea
            </button>
          )}
        </footer>
      </aside>
    </>
  )
}
