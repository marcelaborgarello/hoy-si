import { useEffect, useState } from 'react'
import { useConfig } from '../hooks/useConfig'

type Props = {
  uid: string | null
  onClose: () => void
}

export function Configuracion({ uid, onClose }: Props) {
  const { config, cargando, crearLinkDeConexion, desconectar } = useConfig(uid)
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const conectado = Boolean(config.telegramChatId)

  async function conectar() {
    setAbriendo(true)
    const link = await crearLinkDeConexion()
    setAbriendo(false)
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label="Configuración">
        <header className="panel-head">
          <h2 className="panel-title" style={{ fontSize: 19 }}>
            Configuración
          </h2>
          <button className="btn ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="panel-body">
          <section className="section">
            <h3>Avisos por Telegram</h3>

            {cargando ? (
              <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Un segundo…</p>
            ) : conectado ? (
              <>
                <div className="conectado">
                  <span className="dot" /> Telegram conectado
                </div>
                <p className="ayuda">
                  Te voy a escribir por Telegram cuando se acerque el horario de una tarea.
                  Solo funciona con las tareas que tengan hora.
                </p>
                <button className="btn sm danger" onClick={() => void desconectar()}>
                  Desconectar
                </button>
              </>
            ) : (
              <>
                <p className="ayuda">
                  Conectá Telegram y te aviso cuando se acerque el horario de una tarea.
                  Es un toque: se abre el chat del bot y tocás <b>Empezar</b>.
                </p>
                <button className="btn primary" onClick={() => void conectar()} disabled={abriendo}>
                  {abriendo ? 'Abriendo…' : '✈️ Conectar Telegram'}
                </button>
                <p className="ayuda chico">
                  No hace falta que des tu número ni tu usuario. Si no se abre, revisá que el
                  navegador no haya bloqueado la ventana.
                </p>
              </>
            )}
          </section>

          <section className="section">
            <h3>Avisos por calendario</h3>
            <p className="ayuda">
              No hay nada que configurar. En cada tarea con hora vas a ver el botón
              <b> Google Calendar</b>, que crea el evento y te avisa desde ahí.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
