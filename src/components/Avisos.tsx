import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  /** Link al evento de Google Calendar. null = no se puede todavía. */
  linkCalendar: string | null
  /** Si la persona ya conectó su Telegram en Configuración. */
  telegramConectado: boolean
  sinHora: boolean
  /** En el alta los botones solo informan: la tarea todavía no existe. */
  soloInforma?: boolean
}

/**
 * Los mismos dos avisos, con el mismo aspecto, en el alta y en el detalle.
 * Cuando algo no se puede usar **se muestra apagado con el motivo**, nunca
 * escondido: así se aprende que la opción existe y qué falta para tenerla.
 */
export function Avisos({ linkCalendar, telegramConectado, sinHora, soloInforma }: Props) {
  const motivoHora = 'Ponele una hora y te puedo avisar'

  const telegramOff = sinHora || !telegramConectado
  const motivoTelegram = sinHora
    ? motivoHora
    : 'Conectá Telegram en Configuración (arriba a la derecha)'

  return (
    <div className="alertas">
      <span data-tip={sinHora ? motivoHora : undefined}>
        {soloInforma || sinHora || !linkCalendar ? (
          <span className={`btn alerta${sinHora ? ' off' : ''}`} aria-disabled={sinHora}>
            <IconoCalendar /> Calendar
          </span>
        ) : (
          <a className="btn alerta" href={linkCalendar} target="_blank" rel="noopener noreferrer">
            <IconoCalendar /> Calendar
          </a>
        )}
      </span>

      <span data-tip={telegramOff ? motivoTelegram : undefined}>
        <span className={`btn alerta${telegramOff ? ' off' : ''}`} aria-disabled={telegramOff}>
          <IconoTelegram /> Telegram
          {!telegramOff && <span className="tilde">✓</span>}
        </span>
      </span>
    </div>
  )
}
