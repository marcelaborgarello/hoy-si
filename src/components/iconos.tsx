/**
 * Marcas oficiales de Telegram y Google Calendar, reconstruidas como SVG para
 * que se vean nítidas en cualquier tamaño y no dependan de cargar una imagen.
 *
 * Los colores son los de cada marca, no aproximaciones:
 *   Telegram  #2AABEE → #229ED9 (degradé del círculo)
 *   Google    #4285F4 azul · #EA4335 rojo · #FBBC04 amarillo · #34A853 verde
 */

let idSeq = 0

export function IconoTelegram({ size = 16 }: { size?: number }) {
  // Cada instancia necesita su propio id: dos <defs> con el mismo id hacen que
  // el navegador use siempre el primero y el degradé se pierde.
  const id = `tg-grad-${idSeq++}`
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2aabee" />
          <stop offset="1" stopColor="#229ed9" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill={`url(#${id})`} />
      <path
        fill="#fff"
        d="M54.3 118.8c35-15.2 58.3-25.3 70-30.2 33.3-13.9 40.2-16.3 44.7-16.4 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3.2 1 .4 3.1.2 4.8-1.8 19.3-9.7 66.1-13.7 87.7-1.7 9.1-5 12.2-8.2 12.5-7 .6-12.3-4.6-19-9-10.5-6.9-16.5-11.2-26.7-17.9-11.8-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1-.7-.6-1.7-.4-2.4-.2-1 .2-17.9 11.4-50.6 33.5-4.8 3.3-9.1 4.9-13 4.8-4.3-.1-12.5-2.4-18.6-4.4-7.5-2.4-13.5-3.7-13-7.9.3-2.2 3.3-4.4 8.8-6.5z"
      />
    </svg>
  )
}

/**
 * Google Calendar: cuadrado blanco con el marco en cuatro colores —rojo arriba
 * a la izquierda, azul arriba a la derecha, verde abajo a la derecha y amarillo
 * abajo a la izquierda— y el 31 en azul.
 */
export function IconoCalendar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="4" fill="#fff" />
      {/* Marco: cada esquina en L con su color */}
      <path fill="#ea4335" d="M6 2h18v5H7v17H2V6a4 4 0 014-4z" />
      <path fill="#4285f4" d="M24 2h18a4 4 0 014 4v18h-5V7H24z" />
      <path fill="#34a853" d="M46 24v18a4 4 0 01-4 4H24v-5h17V24z" />
      <path fill="#fbbc04" d="M2 24h5v17h17v5H6a4 4 0 01-4-4z" />
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="19"
        fontWeight="700"
        fill="#4285f4"
        fontFamily="Roboto, Arial, Helvetica, sans-serif"
      >
        31
      </text>
    </svg>
  )
}
