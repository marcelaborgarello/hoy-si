import { useMemo, useState } from 'react'
import { Celebration } from './components/Celebration'
import { Configuracion } from './components/Configuracion'
import { Instalar } from './components/Instalar'
import { Menu } from './components/Menu'
import { SignIn } from './components/SignIn'
import { TaskCard } from './components/TaskCard'
import { TaskDetail } from './components/TaskDetail'
import { TaskForm } from './components/TaskForm'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import { useTasks } from './hooks/useTasks'
import { agrupar, esSuelta } from './lib/agenda'
import { celebrationMessage, computeStats, nudge } from './lib/motivation'
import { formatDueDate } from './lib/time'
import type { NewTask, Status, Task } from './types/task'

type Filter = 'abiertas' | 'todo' | 'doing' | 'done' | 'todas'

/**
 * Dos listas separadas, no una sola con las sin fecha al final.
 *
 * Antes todo convivía en la agenda y lo que no tenía día quedaba en el último
 * bloque: con pocas cosas se leía, con muchas quedaba enterrado y dejaba de
 * existir. Y son dos momentos distintos: volcar todo lo pendiente sin pensar
 * en cuándo, y después decidir qué día se hace cada cosa.
 */
type Vista = 'agenda' | 'sueltas'

const FILTROS: { key: Filter; label: string }[] = [
  { key: 'abiertas', label: 'Abiertas' },
  { key: 'doing', label: 'En curso' },
  { key: 'todo', label: 'Pendientes' },
  { key: 'done', label: 'Hechas' },
  { key: 'todas', label: 'Todas' },
]

function matches(task: Task, filter: Filter): boolean {
  if (filter === 'todas') return true
  if (filter === 'abiertas') return task.status !== 'done'
  return task.status === (filter as Status)
}


export default function App() {
  const auth = useAuth()

  if (auth.loading) {
    return <div className="boot">Un segundo…</div>
  }

  // Con Firebase configurado, sin login no hay app: el uid es lo que
  // autoriza el acceso a los datos.
  if (!auth.offline && !auth.user) {
    return <SignIn onSignIn={() => void auth.signIn()} error={auth.error} />
  }

  return <Board auth={auth} />
}

function Board({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const {
    tasks,
    loading,
    aviso,
    writeError,
    backend,
    add,
    start,
    finish,
    reopen,
    reset,
    edit,
    cambiarAvisos,
    remove,
    addNote,
    removeNote,
  } = useTasks(auth.user?.uid ?? null)

  // Una sola suscripción a la configuración, compartida por toda la pantalla.
  const configAvisos = useConfig(auth.user?.uid ?? null)
  const telegramConectado = Boolean(configAvisos.config.telegramChatId)

  // El nombre elegido gana; si no hay ninguno, se usa el que trae Google.
  const nombreAMostrar =
    configAvisos.nombre || auth.user?.displayName || auth.user?.email || 'vos'

  const [vista, setVista] = useState<Vista>('agenda')
  const [filter, setFilter] = useState<Filter>('abiertas')
  const [openId, setOpenId] = useState<string | null>(null)
  const [party, setParty] = useState<string | null>(null)
  const [verConfig, setVerConfig] = useState(false)
  /**
   * Cuando una tarea cambia de lista, la tarjeta desaparece de la pantalla.
   * Este cartel dice a dónde se fue: sin él parece que se borró.
   */
  const [seFueALaAgenda, setSeFueALaAgenda] = useState<string | null>(null)

  const stats = useMemo(() => computeStats(tasks), [tasks])

  // Cada tarea vive en una sola solapa. La regla está en lib/agenda.ts.
  const { deAgenda, sueltas } = useMemo(() => {
    const sueltas = tasks.filter(esSuelta)
    // Las más viejas arriba: lo que venís pateando hace rato queda a la vista,
    // no enterrado abajo. Es el mismo criterio que la antigüedad en ámbar.
    sueltas.sort((a, b) => a.createdAt - b.createdAt)
    return { deAgenda: tasks.filter((t) => !esSuelta(t)), sueltas }
  }, [tasks])

  // La agenda se muestra en bloques por día, en orden cronológico.
  const grupos = useMemo(
    () => agrupar(deAgenda.filter((t) => matches(t, filter))),
    [deAgenda, filter],
  )

  const hayAlgo = vista === 'agenda' ? grupos.length > 0 : sueltas.length > 0

  const abierta = openId ? (tasks.find((t) => t.id === openId) ?? null) : null

  // Los números de los filtros cuentan solo la agenda, que es donde se ven.
  // Si contaran todo, dirían un número y la lista mostraría otro.
  const counts: Record<Filter, number> = {
    abiertas: deAgenda.filter((t) => t.status !== 'done').length,
    todo: deAgenda.filter((t) => t.status === 'todo').length,
    doing: stats.doing,
    done: stats.done,
    todas: deAgenda.length,
  }

  /**
   * Anotar no puede hacer desaparecer lo que acabás de escribir: si la tarea
   * nace en la otra solapa, la pantalla se va con ella.
   */
  async function anotar(input: NewTask): Promise<boolean> {
    const ok = await add(input)
    if (ok) {
      setVista(input.dueDate ? 'agenda' : 'sueltas')
      setSeFueALaAgenda(null)
    }
    return ok
  }

  /** Ponerle fecha desde la lista la saca de "Sin agendar" y la deja en el día. */
  async function ponerFecha(task: Task, patch: { dueDate: string; dueTime: string | null }) {
    const ok = await edit(task, patch)
    if (ok) {
      setSeFueALaAgenda(
        `📅 “${task.title}” quedó para el ${formatDueDate(patch.dueDate)}` +
          (patch.dueTime ? ` a las ${patch.dueTime}` : ''),
      )
    }
  }

  /**
   * Arrancar una tarea sin fecha también la manda a la agenda, arriba de todo.
   * Es una decisión tomada (lo que estás haciendo va primero), pero desde
   * "Sin agendar" se ve como que la tarjeta se esfumó. Así que se avisa.
   */
  async function empezar(task: Task) {
    const eraSuelta = esSuelta(task)
    const ok = await start(task)
    if (ok && eraSuelta) {
      setSeFueALaAgenda(`▶ “${task.title}” pasó a la agenda: la estás haciendo.`)
    }
  }

  function celebrar(task: Task) {
    setParty(celebrationMessage(task))
  }

  /**
   * Festejar solo si la tarea se guardó de verdad. Antes felicitaba al toque
   * y, si el guardado fallaba, la tarea reaparecía sin tachar: te aplaudía
   * por algo que no había pasado.
   */
  async function toggle(task: Task) {
    if (task.status === 'done') {
      await reopen(task)
      return
    }
    if (await finish(task)) celebrar(task)
  }

  function cambiarVista(cuál: Vista) {
    setVista(cuál)
    // El cartel de "quedó para el martes" ya cumplió: su trabajo era decir a
    // dónde se fue la tarea que desapareció de la lista.
    setSeFueALaAgenda(null)
  }

  // Las mismas para las dos listas, así no se desincronizan.
  const accionesDeTarjeta = {
    onToggle: (t: Task) => void toggle(t),
    onStart: (t: Task) => void empezar(t),
    onOpen: (t: Task) => setOpenId(t.id),
    onCambiarAvisos: (t: Task, patch: { notifyAtTime: boolean; notifyBeforeMin: number | null }) =>
      void cambiarAvisos(t, patch),
    onPonerFecha: (t: Task, patch: { dueDate: string; dueTime: string | null }) =>
      void ponerFecha(t, patch),
    onAbrirConfig: () => setVerConfig(true),
    telegramConectado,
  }

  /** Qué decir cuando la lista que estás mirando está vacía. */
  const vacío =
    tasks.length === 0
      ? { icono: '🌵', texto: 'No hay nada acá. Anotá esa cosa que venís postergando.' }
      : vista === 'sueltas'
        ? { icono: '✨', texto: 'Nada suelto: todo lo que anotaste ya tiene día.' }
        : filter === 'done'
          ? { icono: '🫥', texto: 'Todavía no tachaste nada. La primera es la que más cuesta.' }
          : filter !== 'abiertas'
            ? { icono: '🌵', texto: 'Nada en este filtro. Buena señal.' }
            : sueltas.length > 0
              ? {
                  icono: '🗓️',
                  texto: `La agenda está libre. Tenés ${sueltas.length} sin agendar, por si querés darle día a alguna.`,
                }
              : { icono: '🌵', texto: 'La agenda está libre.' }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>
            <img src="/logo.svg" alt="" width="30" height="30" />
            Hoy sí
          </h1>
          <p className="sub">Anotala, arrancá, tachala. Una cosa por vez.</p>
        </div>
        <div className="account">
          {/* El badge dice dónde están tus cosas de verdad, sin adornar. */}
          <span className={`backend-tag${backend === 'local' ? ' is-local' : ''}`}>
            <span className="dot" />
            {backend === 'firestore' ? 'Guardado en la nube' : 'Solo en esta compu'}
          </span>
          {auth.user && (
            <Menu
              nombre={nombreAMostrar}
              telegramConectado={telegramConectado}
              onAbrirConfig={() => setVerConfig(true)}
              onSalir={() => void auth.signOut()}
            />
          )}
        </div>
      </header>

      <div className="stats">
        <div className="stat is-streak">
          <div className="n">🔥 {stats.streak}</div>
          <div className="lbl">{stats.streak === 1 ? 'día seguido' : 'días seguidos'}</div>
        </div>
        <div className="stat">
          <div className="n">{stats.doneToday}</div>
          <div className="lbl">tachadas hoy</div>
        </div>
        <div className="stat">
          <div className="n">{stats.doing}</div>
          <div className="lbl">en curso</div>
        </div>
        <div className="stat">
          <div className="n">{stats.pending}</div>
          <div className="lbl">esperando</div>
        </div>
      </div>

      {writeError && <div className="nudge is-error">⚠️ {writeError}</div>}

      {aviso ? (
        <div className="nudge is-warn">
          <span>💾 {aviso.text}</span>
          {/* Pista para quien desarrolla. No se compila en el build de producción. */}
          {aviso.hint && <code>{aviso.hint}</code>}
        </div>
      ) : (
        <div className="nudge">👉 {nudge(stats)}</div>
      )}

      <TaskForm onAdd={anotar} telegramConectado={telegramConectado} />

      <div className="vistas" role="tablist" aria-label="Qué lista mirás">
        <button
          className="vista"
          role="tab"
          aria-selected={vista === 'agenda'}
          onClick={() => cambiarVista('agenda')}
        >
          Agenda
          <span className="count">{counts.abiertas}</span>
        </button>
        <button
          className="vista"
          role="tab"
          aria-selected={vista === 'sueltas'}
          onClick={() => cambiarVista('sueltas')}
        >
          Sin agendar
          <span className="count">{sueltas.length}</span>
        </button>
      </div>

      {seFueALaAgenda && (
        <div className="nudge is-ok">
          <span>{seFueALaAgenda}</span>
          {vista !== 'agenda' && (
            <button className="btn ghost sm" onClick={() => cambiarVista('agenda')}>
              Ver la agenda
            </button>
          )}
        </div>
      )}

      {/* Los filtros son de la agenda: en "Sin agendar" todo es pendiente y
          sin fecha, así que cuatro de los cinco darían siempre lo mismo. */}
      {vista === 'agenda' && (
        <div className="filters">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              className="chip"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : !hayAlgo ? (
        <div className="empty">
          <div className="big">{vacío.icono}</div>
          {vacío.texto}
        </div>
      ) : vista === 'sueltas' ? (
        // Lista plana: acá no hay días que separar, y un título "Sin fecha"
        // adentro de la solapa "Sin agendar" sería decir dos veces lo mismo.
        <div className="list">
          {sueltas.map((t) => (
            <TaskCard key={t.id} task={t} {...accionesDeTarjeta} />
          ))}
        </div>
      ) : (
        grupos.map((g) => (
          <section className="dia" key={g.key}>
            <h2 className={`dia-titulo${g.key === 'atrasadas' ? ' es-tarde' : ''}`}>
              <span>{g.titulo}</span>
              {g.sub && <span className="dia-sub">{g.sub}</span>}
              <span className="dia-cuenta">{g.tasks.length}</span>
            </h2>
            <div className="list">
              {g.tasks.map((t) => (
                <TaskCard key={t.id} task={t} {...accionesDeTarjeta} />
              ))}
            </div>
          </section>
        ))
      )}

      {abierta && (
        <TaskDetail
          key={abierta.id}
          task={abierta}
          onClose={() => setOpenId(null)}
          onEdit={(patch) => void edit(abierta, patch)}
          onStart={(task) => void empezar(task)}
          onFinish={(task) => {
            void finish(task).then((ok) => {
              if (ok) celebrar(task)
            })
          }}
          onReset={(task) => void reset(task)}
          onRemove={(id) => void remove(id)}
          onAddNote={(task, text) => void addNote(task, text)}
          onRemoveNote={(task, noteId) => void removeNote(task, noteId)}
          telegramConectado={telegramConectado}
          onCambiarAvisos={(t, patch) => void cambiarAvisos(t, patch)}
        />
      )}

      {verConfig && (
        <Configuracion
          config={configAvisos}
          nombreDeGoogle={auth.user?.displayName ?? auth.user?.email ?? ''}
          uid={auth.user?.uid ?? null}
          onClose={() => setVerConfig(false)}
        />
      )}

      {party && <Celebration key={party} message={party} onDone={() => setParty(null)} />}

      {/* Se esconde solo si ya está instalada o si el navegador no lo ofrece. */}
      <Instalar />
    </div>
  )
}
