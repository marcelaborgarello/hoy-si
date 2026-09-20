import { useEffect, useRef } from 'react'
import type { Task } from '../types/task'
import { formatHora } from '../lib/time'

/** Opciones de anticipación del aviso previo. */
export const ANTICIPACIONES: { min: number; label: string }[] = [
  { min: 10, label: '10 minutos antes' },
  { min: 30, label: '30 minutos antes' },
  { min: 60, label: '1 hora antes' },
  { min: 180, label: '3 horas antes' },
  { min: 1440, label: 'El día anterior' },
]

const ANTICIPACION_POR_DEFECTO = 30

type Props = {
  task: Task
  onCambiar: (patch: { notifyAtTime: boolean; notifyBeforeMin: number | null }) => void
  onCerrar?: () => void
  /** En el panel de detalle va suelto, sin globo ni botón de cerrar. */
  embebido?: boolean
}

/**
 * Las dos casillas de aviso, en un globo que sale de la tarjeta.
 *
 * Son **independientes a propósito**: se puede querer solo el anticipado (algo
 * que hay que preparar media hora antes, y a la hora ya no sirve que suene),
 * solo el de la hora, o los dos.
 *
 * Destildar las dos apaga el aviso. No hace falta un botón de "no avisarme"
 * ni un cartel: el ícono de la tarjeta vuelve a gris y eso ya lo dice.
 */
export function ElegirAvisos({ task, onCambiar, onCerrar, embebido }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (embebido || !onCerrar) return
    const alApretarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretarEscape)
    return () => window.removeEventListener('keydown', alApretarEscape)
  }, [onCerrar, embebido])

  const antes = task.notifyBeforeMin

  return (
    <>
    {/* Capa transparente para cerrar tocando afuera. Antes esto se hacía
        escuchando `mousedown` en el documento y preguntando si el click
        había caído adentro, pero se cerraba al tildar una casilla. La capa
        no tiene esa ambigüedad: lo que la toca está afuera, y punto. */}
    {!embebido && onCerrar && <div className="pop-tapa" onClick={onCerrar} />}
    <div
      className={embebido ? 'avisos-plano' : 'avisos-pop'}
      ref={ref}
      role={embebido ? undefined : 'dialog'}
      aria-label={embebido ? undefined : 'Elegir avisos'}
    >
      {!embebido && <p className="avisos-pop-titulo">Avisarme por Telegram</p>}

      <label className="avisos-pop-fila">
        <input
          type="checkbox"
          checked={task.notifyAtTime}
          onChange={(e) =>
            onCambiar({ notifyAtTime: e.target.checked, notifyBeforeMin: antes })
          }
        />
        <span>
          A la hora
          {task.dueTime && <span className="avisos-pop-hora"> ({formatHora(task.dueTime)})</span>}
        </span>
      </label>

      <label className="avisos-pop-fila">
        <input
          type="checkbox"
          checked={antes !== null}
          onChange={(e) =>
            onCambiar({
              notifyAtTime: task.notifyAtTime,
              notifyBeforeMin: e.target.checked ? ANTICIPACION_POR_DEFECTO : null,
            })
          }
        />
        <span>Antes</span>
        <select
          className="dt"
          disabled={antes === null}
          value={antes ?? ANTICIPACION_POR_DEFECTO}
          onChange={(e) =>
            onCambiar({ notifyAtTime: task.notifyAtTime, notifyBeforeMin: Number(e.target.value) })
          }
          onClick={(e) => e.stopPropagation()}
        >
          {ANTICIPACIONES.map((a) => (
            <option key={a.min} value={a.min}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <div className="avisos-pop-pie">
        {!task.notifyAtTime && antes === null ? (
          <span className="avisos-pop-nota">Sin avisos: esta tarea no te va a escribir.</span>
        ) : (
          <span className="avisos-pop-nota">
            {task.notifyAtTime && antes !== null ? 'Te llegan dos avisos.' : 'Te llega un aviso.'}
          </span>
        )}
        {!embebido && onCerrar && (
          <button className="btn sm" onClick={onCerrar}>
            Listo
          </button>
        )}
      </div>
    </div>
    </>
  )
}
