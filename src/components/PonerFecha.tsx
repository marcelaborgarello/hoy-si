import { useEffect, useState } from 'react'
import type { Task } from '../types/task'
import { todayKey } from '../lib/time'

type Props = {
  task: Task
  /** Solo se llama al tocar "Agendar": la tarea se mueve cuando vos decidís. */
  onGuardar: (patch: { dueDate: string; dueTime: string | null }) => void
  onCerrar: () => void
}

/**
 * Globo para ponerle día (y hora, si querés) a una tarea desde la lista misma.
 *
 * Existe porque el uso real es al revés de como parece: primero se vuelca todo
 * lo pendiente sin pensar en cuándo, y después se va sacando de ahí — "esto lo
 * hago el martes". Si para eso hay que abrir el detalle y buscar la sección
 * Fechas, ese repaso no se hace. Es la regla del punto 7m de AGENTS.md: lo que
 * se configura por tarea se tiene que poder configurar desde la lista.
 *
 * Nada se guarda mientras elegís. Si se guardara al cambiar el día, la tarea
 * saltaría a la agenda en ese mismo instante, el globo se iría de la pantalla
 * con ella y no habría forma de ponerle la hora.
 */
export function PonerFecha({ task, onGuardar, onCerrar }: Props) {
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task.dueTime ?? '')

  useEffect(() => {
    const alApretarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretarEscape)
    return () => window.removeEventListener('keydown', alApretarEscape)
  }, [onCerrar])

  function agendar() {
    if (!dueDate) return
    onGuardar({ dueDate, dueTime: dueTime || null })
  }

  return (
    <>
      {/* Misma capa transparente que el globo de avisos: lo que la toca está
          afuera. Ver el detalle técnico en ElegirAvisos.tsx. */}
      <div className="pop-tapa" onClick={onCerrar} />
      <div className="fecha-pop" role="dialog" aria-label="Ponerle fecha a la tarea">
        <p className="avisos-pop-titulo">¿Para cuándo?</p>

        <label className="fecha-pop-fila">
          <span>El día</span>
          <input
            type="date"
            className={`dt${dueDate ? '' : ' vacio'}`}
            value={dueDate}
            autoFocus
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Día"
          />
        </label>

        <label className="fecha-pop-fila">
          <span>A las</span>
          <input
            type="time"
            className={`dt${dueTime ? '' : ' vacio'}`}
            value={dueTime}
            onChange={(e) => {
              setDueTime(e.target.value)
              // "A las 9" sin decir qué día es lo más natural del mundo:
              // se asume hoy, igual que en el formulario de arriba.
              if (e.target.value && !dueDate) setDueDate(todayKey())
            }}
            aria-label="Hora"
          />
        </label>

        <div className="avisos-pop-pie">
          <span className="avisos-pop-nota">
            {dueTime ? 'Con hora te puedo avisar.' : 'Sin hora = todo el día.'}
          </span>
          <span className="fecha-pop-botones">
            <button type="button" className="btn ghost sm" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="btn primary sm" disabled={!dueDate} onClick={agendar}>
              Agendar
            </button>
          </span>
        </div>
      </div>
    </>
  )
}
