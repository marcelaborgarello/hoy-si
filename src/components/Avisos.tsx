import type { Task } from '../types/task'
import { ElegirAvisos } from './ElegirAvisos'
import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  /** Link al evento de Google Calendar. null = no se puede todavía. */
  linkCalendar: string | null
  /** Si la persona ya conectó su Telegram en Configuración. */
  telegramConectado: boolean
  sinHora: boolean
  /** En el alta los botones solo informan: la tarea todavía no existe. */
  soloInforma?: boolean
  /** La tarea y cómo cambiar sus avisos. Solo en el detalle. */
  task?: Task
  onCambiarAvisos?: (patch: { notifyAtTime: boolean; notifyBeforeMin: number | null }) => void
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
  task,
  onCambiarAvisos,
}: Props) {
  const motivoHora = 'Ponele una hora y te puedo avisar'

  // ⚠️ El botón decía "Telegram" y no es un botón de Telegram: es el ÚNICO
  // interruptor del aviso, y vale para Telegram y para los avisos del aparato.
  // Por eso ahora dice "Avisarme".
  //
  // Queda algo peor sin arreglar, y es de comportamiento, no de texto: mientras
  // `telegramConectado` sea false el botón está deshabilitado, así que **sin
  // Telegram no se puede prender ningún aviso, ni siquiera el del aparato**.
  // Anotado en docs/pendientes.md.
  const telegramOff = sinHora || !telegramConectado
  const motivoTelegram = sinHora
    ? motivoHora
    : 'Conectá Telegram en Configuración (arriba a la derecha)'

  const encendido = Boolean(task?.notify) && !telegramOff
  const puedeElegir = task && onCambiarAvisos && !telegramOff && !soloInforma

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
          {puedeElegir ? (
            <button
              type="button"
              className={`btn alerta${encendido ? ' on' : ' off'}`}
              aria-pressed={encendido}
              onClick={() =>
                // Al prender desde cero se arranca con el aviso de la hora.
                onCambiarAvisos(
                  encendido
                    ? { notifyAtTime: false, notifyBeforeMin: null }
                    : { notifyAtTime: true, notifyBeforeMin: null },
                )
              }
            >
              <IconoTelegram /> Avisarme
              {encendido && <span className="tilde">✓</span>}
            </button>
          ) : (
            <span className={`btn alerta${telegramOff || !encendido ? ' off' : ''}`}>
              <IconoTelegram /> Avisarme
            </span>
          )}
        </span>
      </div>

      {/* Las casillas aparecen solo con el aviso prendido: sin eso no hay nada
          que elegir. */}
      {encendido && puedeElegir && (
        <ElegirAvisos task={task} onCambiar={onCambiarAvisos} embebido />
      )}
    </>
  )
}
