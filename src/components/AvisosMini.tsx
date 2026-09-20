import type { Task } from '../types/task'
import { linkGoogleCalendar, puedeTenerAlerta } from '../lib/alertas'
import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  task: Task
  telegramConectado: boolean
}

/**
 * Los dos avisos dentro de la tarjeta, solo con el logo.
 *
 * Es la misma idea que la sección "Avisame" del detalle, pero del tamaño que
 * tolera una fila de la lista: sin texto, apoyándose en el logo y el tooltip.
 * Está acá porque tener que abrir el detalle para saber si una tarea te va a
 * avisar es justo lo que hay que evitar.
 */
export function AvisosMini({ task, telegramConectado }: Props) {
  const sinHora = !puedeTenerAlerta(task)
  const link = linkGoogleCalendar(task)
  const telegramOff = sinHora || !telegramConectado

  const motivoHora = 'Ponele una hora y te puedo avisar'

  return (
    <span className="avisos-mini">
      <span data-tip={sinHora ? motivoHora : 'Agendar en Google Calendar'}>
        {link ? (
          <a
            className="mini"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Agendar en Google Calendar"
            onClick={(e) => e.stopPropagation()}
          >
            <IconoCalendar size={17} />
          </a>
        ) : (
          <span className="mini off" aria-hidden="true">
            <IconoCalendar size={17} />
          </span>
        )}
      </span>

      <span
        data-tip={
          sinHora
            ? motivoHora
            : telegramConectado
              ? 'Te aviso por Telegram'
              : 'Conectá Telegram en Configuración'
        }
      >
        <span className={`mini${telegramOff ? ' off' : ''}`} aria-hidden="true">
          <IconoTelegram size={17} />
        </span>
      </span>
    </span>
  )
}
