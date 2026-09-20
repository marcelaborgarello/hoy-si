import { useEffect, useRef, useState } from 'react'
import { IconoTelegram } from './iconos'

type Props = {
  /** El nombre que se muestra: el elegido, o el de Google si no hay ninguno. */
  nombre: string
  telegramConectado: boolean
  onAbrirConfig: () => void
  onSalir: () => void
}

/**
 * Menú de la esquina. Junta lo que antes estaba suelto en el header (nombre,
 * configuración, salir) y deja lugar para lo que venga.
 *
 * Lleva un punto de aviso cuando Telegram no está conectado: sin eso, no hay
 * forma de enterarse de que esa opción existe hasta chocarse con un botón
 * apagado en una tarea.
 */
export function Menu({ nombre, telegramConectado, onAbrirConfig, onSalir }: Props) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return

    const alTocarAfuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alApretarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', alTocarAfuera)
    window.addEventListener('keydown', alApretarEscape)
    return () => {
      document.removeEventListener('mousedown', alTocarAfuera)
      window.removeEventListener('keydown', alApretarEscape)
    }
  }, [abierto])

  return (
    <div className="menu" ref={ref}>
      <button
        className="menu-btn"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label="Menú"
      >
        <span className="hamburguesa" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {/* El punto avisa que hay algo sin configurar. */}
        {!telegramConectado && <span className="punto" aria-hidden="true" />}
      </button>

      {abierto && (
        <div className="menu-panel" role="menu">
          <div className="menu-quien">
            <span className="menu-nombre">{nombre}</span>
          </div>

          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setAbierto(false)
              onAbrirConfig()
            }}
          >
            <span>⚙️ Configuración</span>
            {!telegramConectado && <span className="menu-badge">Falta Telegram</span>}
          </button>

          {telegramConectado && (
            <div className="menu-estado">
              <IconoTelegram size={14} /> Telegram conectado
            </div>
          )}

          <hr className="menu-sep" />

          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setAbierto(false)
              onSalir()
            }}
          >
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
