import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  esIOS,
  hayInstalacionDeUnToque,
  instalar,
  suscribirseAInstalable,
  yaEstaInstalada,
} from '../lib/instalable'

/**
 * El cartelito que ofrece poner la app en la pantalla de inicio.
 *
 * Hay dos mundos y no se parecen en nada:
 *
 * - **Android:** el navegador avisa que se puede instalar y se abre el cartel
 *   con un botón. Un toque y listo.
 * - **iPhone:** Safari no ofrece nada ni deja pedirlo desde el código. Lo
 *   único posible es explicar el camino a mano.
 *
 * Por eso el mismo componente muestra un botón o una instrucción, según dónde
 * esté corriendo. Si el navegador no ofrece nada y tampoco es un iPhone, no
 * aparece: antes que un botón que no hace nada, mejor ninguno.
 */

/** Cuánto esperar antes de aparecer, para no tapar la primera pantalla. */
const DEMORA_MS = 4000

export function Instalar() {
  const puedeDeUnToque = useSyncExternalStore(
    suscribirseAInstalable,
    hayInstalacionDeUnToque,
    () => false,
  )

  const [cerrado, setCerrado] = useState(false)
  const [listoParaMostrar, setListoParaMostrar] = useState(false)
  const [instalando, setInstalando] = useState(false)

  const enIOS = esIOS()
  const instalada = yaEstaInstalada()

  useEffect(() => {
    const t = setTimeout(() => setListoParaMostrar(true), DEMORA_MS)
    return () => clearTimeout(t)
  }, [])

  // Ya la tiene instalada: no hay nada que ofrecer.
  if (instalada || cerrado || !listoParaMostrar) return null

  // Ni el navegador lo ofrece ni es un iPhone (donde hay que explicarlo):
  // entonces acá no se puede instalar y no se inventa un botón que no anda.
  if (!puedeDeUnToque && !enIOS) return null

  async function alInstalar() {
    setInstalando(true)
    const resultado = await instalar()
    setInstalando(false)
    // Si aceptó, el evento `appinstalled` esconde esto solo. Si dijo que no,
    // se respeta: no se vuelve a insistir en esta visita.
    if (resultado !== 'instalada') setCerrado(true)
  }

  return (
    <div className="instalar" role="region" aria-label="Instalar la app">
      <img className="instalar-logo" src="/logo.svg" alt="" width="34" height="34" />

      <div className="instalar-texto">
        <strong>Tenela a mano</strong>
        {enIOS && !puedeDeUnToque ? (
          <p>
            Tocá <b>Compartir</b> abajo y después <b>Agregar a inicio</b>.
          </p>
        ) : (
          <p>Ponela en tu pantalla de inicio y abrila como cualquier otra app.</p>
        )}
      </div>

      {puedeDeUnToque && (
        <button className="btn primary sm" onClick={() => void alInstalar()} disabled={instalando}>
          {instalando ? 'Un segundo…' : 'Instalar'}
        </button>
      )}

      <button
        className="instalar-cerrar"
        onClick={() => setCerrado(true)}
        aria-label="Ahora no"
      >
        ✕
      </button>
    </div>
  )
}
