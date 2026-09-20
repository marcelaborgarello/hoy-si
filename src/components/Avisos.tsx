import { IconoCalendar, IconoTelegram } from './iconos'

/** Opciones de anticipación. null = solo avisar a la hora exacta. */
export const ANTICIPACIONES: { min: number | null; label: string }[] = [
  { min: null, label: 'Solo a la hora' },
  { min: 10, label: '10 min antes' },
  { min: 30, label: '30 min antes' },
  { min: 60, label: '1 hora antes' },
  { min: 180, label: '3 horas antes' },
  { min: 1440, label: 'El día anterior' },
]

type Props = {
  /** Link al evento de Google Calendar. null = no se puede todavía. */
  linkCalendar: string | null
  /** Si la persona ya conectó su Telegram en Configuración. */
  telegramConectado: boolean
  sinHora: boolean
  /** En el alta los botones solo informan: la tarea todavía no existe. */
  soloInforma?: boolean
  /** Estado del aviso de esta tarea y cómo cambiarlo (solo en el detalle). */
  notify?: boolean
  notifyBeforeMin?: number | null
  onToggleNotify?: () => void
  onChangeAnticipacion?: (min: number | null) => void
}

/**
 * Los mismos dos avisos, con el mismo aspecto, en el alta y en el detalle.
 * Cuando algo no se puede usar **se muestra apagado con el motivo**, nunca
 * escondido: así se aprende que la opción existe y qué falta para tenerla.
 */
export function Avisos({
  linkCalendar,
  telegramConectado,
  sinHora,
  soloInforma,
  notify = false,
  notifyBeforeMin = null,
  onToggleNotify,
  onChangeAnticipacion,
}: Props) {
  const motivoHora = 'Ponele una hora y te puedo avisar'

  const telegramOff = sinHora || !telegramConectado
  const motivoTelegram = sinHora
    ? motivoHora
    : 'Conectá Telegram en Configuración (arriba a la derecha)'

  const encendido = notify && !telegramOff

  return (
    <>
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
        {soloInforma || !onToggleNotify ? (
          <span className={`btn alerta${telegramOff ? ' off' : ''}`} aria-disabled={telegramOff}>
            <IconoTelegram /> Telegram
          </span>
        ) : (
          <button
            type="button"
            className={`btn alerta${encendido ? ' on' : ' off'}`}
            disabled={telegramOff}
            aria-pressed={encendido}
            onClick={onToggleNotify}
          >
            <IconoTelegram /> Telegram
            {encendido && <span className="tilde">✓</span>}
          </button>
        )}
      </span>
    </div>

    {/* La anticipación solo tiene sentido con el aviso encendido. */}
    {encendido && onChangeAnticipacion && (
      <label className="anticipacion">
        Avisarme
        <select
          className="dt"
          value={notifyBeforeMin === null ? '' : String(notifyBeforeMin)}
          onChange={(e) =>
            onChangeAnticipacion(e.target.value === '' ? null : Number(e.target.value))
          }
        >
          {ANTICIPACIONES.map((a) => (
            <option key={a.label} value={a.min === null ? '' : a.min}>
              {a.label}
            </option>
          ))}
        </select>
        {notifyBeforeMin !== null && (
          <span className="ayuda chico" style={{ margin: 0 }}>
            Te llegan dos: ese aviso y otro a la hora exacta.
          </span>
        )}
      </label>
    )}
    </>
  )
}
