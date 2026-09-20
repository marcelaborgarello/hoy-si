import type { Task } from '../types/task'
import { linkGoogleCalendar, puedeTenerAlerta } from '../lib/alertas'
import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  task: Task
  telegramConectado: boolean
  onToggleAviso: (task: Task) => void
  /** Si falta conectar Telegram, el botón lleva ahí en vez de no hacer nada. */
  onAbrirConfig: () => void
}

/**
 * Los dos avisos dentro de la tarjeta, solo con el logo.
 *
 * El de Telegram es un interruptor: tener hora significa que la tarea está
 * agendada, no que tenga que sonar el teléfono. Se enciende a propósito, por
 * tarea. El de Calendar es un link.
 */
export function AvisosMini({ task, telegramConectado, onToggleAviso, onAbrirConfig }: Props) {
  const sinHora = !puedeTenerAlerta(task)
  const link = linkGoogleCalendar(task)

  // Con hora pero sin Telegram, el botón sigue vivo: lleva a conectarlo.
  const faltaConectar = !sinHora && !telegramConectado
  const puedeAvisar = !sinHora && telegramConectado

  const motivoHora = 'Ponele una hora y te puedo avisar'

  const tipTelegram = sinHora
    ? motivoHora
    : faltaConectar
      ? 'Tocá para conectar Telegram y que te avise'
      : task.notify
        ? 'Te aviso por Telegram. Tocá para no recibir aviso'
        : 'Tocá para que te avise por Telegram'

  return (
    <span className="avisos-mini" onClick={(e) => e.stopPropagation()}>
      <span data-tip={sinHora ? motivoHora : 'Agendar en Google Calendar'}>
        {link ? (
          <a
            className="mini"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Agendar en Google Calendar"
          >
            <IconoCalendar size={17} />
          </a>
        ) : (
          <span className="mini off" aria-hidden="true">
            <IconoCalendar size={17} />
          </span>
        )}
      </span>

      <span data-tip={tipTelegram}>
        <button
          type="button"
          className={`mini${task.notify && puedeAvisar ? ' on' : ' off'}`}
          disabled={sinHora}
          aria-pressed={task.notify}
          aria-label={tipTelegram}
          onClick={() => (faltaConectar ? onAbrirConfig() : onToggleAviso(task))}
        >
          <IconoTelegram size={17} />
        </button>
      </span>
    </span>
  )
}
