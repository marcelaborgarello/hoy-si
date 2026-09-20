import { useState } from 'react'
import type { Task } from '../types/task'
import { linkGoogleCalendar, puedeTenerAlerta, tieneAlgunAviso } from '../lib/alertas'
import { ElegirAvisos } from './ElegirAvisos'
import { IconoCalendar, IconoTelegram } from './iconos'

type Props = {
  task: Task
  telegramConectado: boolean
  onCambiarAvisos: (
    task: Task,
    patch: { notifyAtTime: boolean; notifyBeforeMin: number | null },
  ) => void
  /** Si falta conectar Telegram, el botón lleva ahí en vez de no hacer nada. */
  onAbrirConfig: () => void
}

/**
 * Los dos avisos dentro de la tarjeta, solo con el logo.
 *
 * El de Telegram abre el globo para elegir los avisos ahí mismo: antes había
 * que entrar al detalle para descubrir que se podía avisar con anticipación,
 * y nadie lo encontraba.
 */
export function AvisosMini({ task, telegramConectado, onCambiarAvisos, onAbrirConfig }: Props) {
  const [eligiendo, setEligiendo] = useState(false)

  const sinHora = !puedeTenerAlerta(task)
  const link = linkGoogleCalendar(task)

  const faltaConectar = !sinHora && !telegramConectado
  const encendido = task.notify && !sinHora && telegramConectado

  const motivoHora = 'Ponele una hora y te puedo avisar'
  const tipTelegram = sinHora
    ? motivoHora
    : faltaConectar
      ? 'Tocá para conectar Telegram y que te avise'
      : encendido
        ? 'Tocá para cambiar los avisos'
        : 'Tocá para que te avise por Telegram'

  /** Al prender desde cero, se arranca con el aviso de la hora tildado. */
  function alTocarTelegram() {
    if (faltaConectar) return onAbrirConfig()
    if (!task.notify) {
      onCambiarAvisos(task, { notifyAtTime: true, notifyBeforeMin: null })
    }
    setEligiendo(true)
  }

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

      <span className="avisos-ancla" data-tip={eligiendo ? undefined : tipTelegram}>
        <button
          type="button"
          className={`mini${encendido ? ' on' : ' off'}`}
          disabled={sinHora}
          aria-expanded={eligiendo}
          aria-label={tipTelegram}
          onClick={alTocarTelegram}
        >
          <IconoTelegram size={17} />
        </button>

        {eligiendo && (
          <ElegirAvisos
            task={task}
            onCambiar={(patch) => onCambiarAvisos(task, patch)}
            onCerrar={() => setEligiendo(false)}
          />
        )}
      </span>
    </span>
  )
}

/** Resumen corto de los avisos, para mostrar en la fila de la tarjeta. */
export function resumenAvisos(task: Task): string | null {
  if (!task.notify || !tieneAlgunAviso(task)) return null

  const antes = task.notifyBeforeMin
  const texto =
    antes === null
      ? 'a la hora'
      : antes >= 1440
        ? 'el día antes'
        : antes >= 60
          ? `${antes / 60} h antes`
          : `${antes} min antes`

  return task.notifyAtTime && antes !== null ? `${texto} y a la hora` : texto
}
