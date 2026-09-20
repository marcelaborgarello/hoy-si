import { useMemo, useState } from 'react'
import { Celebration } from './components/Celebration'
import { SignIn } from './components/SignIn'
import { TaskCard } from './components/TaskCard'
import { TaskDetail } from './components/TaskDetail'
import { TaskForm } from './components/TaskForm'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { celebrationMessage, computeStats, nudge } from './lib/motivation'
import type { Status, Task } from './types/task'

type Filter = 'abiertas' | 'todo' | 'doing' | 'done' | 'todas'

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

/** Primero lo que está en curso, después pendientes (más viejas arriba), al final lo hecho. */
const ORDEN: Record<Status, number> = { doing: 0, todo: 1, done: 2 }

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
    remove,
    addNote,
    removeNote,
  } = useTasks(auth.user?.uid ?? null)

  const [filter, setFilter] = useState<Filter>('abiertas')
  const [openId, setOpenId] = useState<string | null>(null)
  const [party, setParty] = useState<string | null>(null)

  const stats = useMemo(() => computeStats(tasks), [tasks])

  const visibles = useMemo(
    () =>
      tasks
        .filter((t) => matches(t, filter))
        .sort((a, b) => {
          const d = ORDEN[a.status] - ORDEN[b.status]
          if (d !== 0) return d
          if (a.status === 'done') return (b.finishedAt ?? 0) - (a.finishedAt ?? 0)
          return a.createdAt - b.createdAt
        }),
    [tasks, filter],
  )

  const abierta = openId ? (tasks.find((t) => t.id === openId) ?? null) : null

  const counts: Record<Filter, number> = {
    abiertas: stats.pending + stats.doing,
    todo: stats.pending,
    doing: stats.doing,
    done: stats.done,
    todas: stats.total,
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Hoy sí</h1>
          <p className="sub">Anotala, arrancá, tachala. Una cosa por vez.</p>
        </div>
        <div className="account">
          {/* El badge dice dónde están tus cosas de verdad, sin adornar. */}
          <span className={`backend-tag${backend === 'local' ? ' is-local' : ''}`}>
            <span className="dot" />
            {backend === 'firestore' ? 'Guardado en la nube' : 'Solo en esta compu'}
          </span>
          {auth.user && (
            <>
              <span className="who" title={auth.user.email ?? ''}>
                {auth.user.displayName ?? auth.user.email}
              </span>
              <button className="btn ghost sm" onClick={() => void auth.signOut()}>
                Salir
              </button>
            </>
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

      <TaskForm onAdd={add} />

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

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="empty">
          <div className="big">{filter === 'done' ? '🫥' : '🌵'}</div>
          {filter === 'done'
            ? 'Todavía no tachaste nada. La primera es la que más cuesta.'
            : tasks.length === 0
              ? 'No hay nada acá. Anotá esa cosa que venís postergando.'
              : 'Nada en este filtro. Buena señal.'}
        </div>
      ) : (
        <div className="list">
          {visibles.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onToggle={(t) => void toggle(t)}
              onStart={(task) => void start(task)}
              onOpen={(task) => setOpenId(task.id)}
            />
          ))}
        </div>
      )}

      {abierta && (
        <TaskDetail
          task={abierta}
          onClose={() => setOpenId(null)}
          onEdit={(id, patch) => void edit(id, patch)}
          onStart={(task) => void start(task)}
          onFinish={(task) => {
            void finish(task).then((ok) => {
              if (ok) celebrar(task)
            })
          }}
          onReset={(task) => void reset(task)}
          onRemove={(id) => void remove(id)}
          onAddNote={(task, text) => void addNote(task, text)}
          onRemoveNote={(task, noteId) => void removeNote(task, noteId)}
        />
      )}

      {party && <Celebration key={party} message={party} onDone={() => setParty(null)} />}
    </div>
  )
}
