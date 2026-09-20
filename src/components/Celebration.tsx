import { useEffect, useMemo } from 'react'

const COLORS = ['#7dd3a0', '#ffd166', '#7cc4ff', '#ff9f6b', '#e8ecf5']

type Props = {
  message: string
  onDone: () => void
}

/** Festejo breve al tachar algo. Dura poco y no interrumpe nada. */
export function Celebration({ message, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [message, onDone])

  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.45,
        duration: 1.6 + Math.random() * 1.1,
        color: COLORS[i % COLORS.length],
      })),
    // Se monta de nuevo en cada festejo (App le pasa key={party}), así que
    // calcular una sola vez por montaje es justo lo que queremos.
    [],
  )

  return (
    <>
      <div className="confetti" aria-hidden="true">
        {pieces.map((p) => (
          <i
            key={p.id}
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="toast" role="status">
        {message}
      </div>
    </>
  )
}
