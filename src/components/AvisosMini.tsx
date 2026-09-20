import type { Task } from '../types/task'
import { linkGoogleCalendar, puedeTenerAlerta } from '../lib/alertas'
import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  task: Task
  telegramConectado: boolean
  onToggleAviso: (task: Task) => void
}

/**
 * Los dos avisos dentro de la tarjeta, solo con el logo.
 *
 * El de Telegram es un interruptor: tener hora significa que la tarea está
 * agendada, no que tenga que sonar el teléfono. Se enciende a propósito, por
 * tarea. El de Calendar es un link.
 */
export function AvisosMini({ task, telegramConectado, onToggleAviso }: Props) {
  const sinHora = !puedeTenerAlerta(task)
  const link = linkGoogleCalendar(task)
  const puedeAvisar = !sinHora && telegramConectado

  const motivoHora = 'Ponele una hora y te puedo avisar'

  const tipTelegram = sinHora
    ? motivoHora
    : !telegramConectado
      ? 'Conectá Telegram en Configuración'
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
          disabled={!puedeAvisar}
          aria-pressed={task.notify}
          aria-label={tipTelegram}
          onClick={() => onToggleAviso(task)}
        >
          <IconoTelegram size={17} />
        </button>
      </span>
    </span>
  )
}
