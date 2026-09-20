import { useEffect, useState } from 'react'
import type { useConfig } from '../hooks/useConfig'
import { usePush } from '../hooks/usePush'
import { IconoTelegram } from './iconos'

type Props = {
  /** Viene de App: una sola suscripción para toda la pantalla. */
  config: ReturnType<typeof useConfig>
  /** El de la cuenta de Google, para mostrarlo como sugerencia. */
  nombreDeGoogle: string
  /** UID del usuario para las notificaciones push */
  uid: string | null
  onClose: () => void
}

export function Configuracion({ config: cfg, nombreDeGoogle, uid, onClose }: Props) {
  const { config, nombre, guardarNombre, cargando, crearLinkDeConexion, desconectar } = cfg
  const [abriendo, setAbriendo] = useState(false)
  const [nombreEditado, setNombreEditado] = useState(nombre)
  const push = usePush(uid)

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
            <h3>Tu nombre</h3>
            <p className="ayuda">
              Con esto te saluda la app. Si lo dejás vacío, usa el de tu cuenta de Google.
            </p>
            <input
              className="desc-edit"
              style={{ minHeight: 'auto' }}
              value={nombreEditado}
              maxLength={60}
              placeholder={nombreDeGoogle}
              onChange={(e) => setNombreEditado(e.target.value)}
              onBlur={() => void guardarNombre(nombreEditado)}
              aria-label="Tu nombre"
            />
          </section>

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
                  <IconoTelegram size={17} />
                  {abriendo ? 'Abriendo…' : 'Conectar Telegram'}
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

          <section className="section">
            <h3>Avisos push (sonido personalizado)</h3>
            {!push.soportado ? (
              <p className="ayuda">Tu navegador no soporta notificaciones push.</p>
            ) : push.habilitado ? (
              <>
                <div className="conectado">
                  <span className="dot" /> Notificaciones activadas
                </div>
                <p className="ayuda">
                  Te voy a avisar con un sonido especial cuando se acerque el horario de una tarea.
                  Solo funciona con las tareas que tengan hora.
                </p>
              </>
            ) : (
              <>
                <p className="ayuda">
                  Activá las notificaciones push y te aviso con un sonido personalizado cuando se acerque el horario de una tarea.
                  Es un toque: el navegador te va a pedir permiso.
                </p>
                <button
                  className="btn primary"
                  onClick={() => void push.pedirPermiso()}
                  disabled={!push.puedePedir}
                >
                  {push.permiso === 'denied' ? 'Permisos denegados' : 'Activar notificaciones'}
                </button>
                {push.permiso === 'denied' && (
                  <p className="ayuda chico">
                    Denegaste los permisos. Para activarlos, revisá la configuración de tu navegador.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
