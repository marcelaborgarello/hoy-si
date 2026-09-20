import { useState } from 'react'
import type { NewTask } from '../types/task'
import { todayKey } from '../lib/time'

type Props = {
  /** Devuelve false si no se pudo guardar: ahí no borramos lo escrito. */
  onAdd: (input: NewTask) => Promise<boolean>
}

export function TaskForm({ onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDate, setShowDate] = useState(false)

  const canSubmit = title.trim().length > 0

  async function submit() {
    if (!canSubmit || saving) return
    setSaving(true)
    const ok = await onAdd({
      title,
      description,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
    })
    setSaving(false)
    if (!ok) return // el error se muestra arriba; no te borramos lo que escribiste
    setTitle('')
    setDescription('')
    setDueDate('')
    setDueTime('')
    setShowDate(false)
    setExpanded(false)
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <input
        className="field title"
        placeholder="¿Qué venís pateando?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setExpanded(true)}
        aria-label="Título de la tarea"
      />

      {expanded && (
        <div className="composer-extra">
          <textarea
            className="field"
            placeholder="Descripción — el detalle que después no te vas a acordar"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Descripción"
          />
        </div>
      )}

      <div className="composer-foot">
        {/* La fecha hay que pedirla a propósito: antes estaba siempre visible
            al lado de "Anotar" y se ponía sin querer. */}
        {showDate ? (
          <label className="date-input">
            Para el{' '}
            <input
              type="date"
              className={`dt${dueDate ? '' : ' vacio'}`}
              value={dueDate}
              autoFocus
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Fecha límite"
            />
            a las
            <input
              type="time"
              className={`dt${dueTime ? '' : ' vacio'}`}
              value={dueTime}
              onChange={(e) => {
                setDueTime(e.target.value)
                // Poner hora sin día es lo más natural del mundo ("a las 9").
                // Se asume hoy en vez de obligarte a elegir la fecha primero.
                if (e.target.value && !dueDate) setDueDate(todayKey())
              }}
              aria-label="Hora límite"
            />
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setDueDate('')
                setDueTime('')
                setShowDate(false)
              }}
              aria-label="Sacar la fecha"
            >
              ✕
            </button>
          </label>
        ) : (
          <button type="button" className="btn ghost sm" onClick={() => setShowDate(true)}>
            📅 Ponerle fecha y hora
          </button>
        )}
        <button className="btn primary" type="submit" disabled={!canSubmit || saving}>
          {saving ? 'Guardando…' : 'Anotar'}
        </button>
      </div>
    </form>
  )
}
