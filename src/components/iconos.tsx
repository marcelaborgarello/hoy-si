/**
 * Marcas oficiales, dibujadas como SVG para que se vean nítidas en cualquier
 * pantalla y no dependan de cargar una imagen externa.
 */

export function IconoTelegram({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2aabee" />
          <stop offset="1" stopColor="#229ed9" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#tg)" />
      <path
        fill="#fff"
        d="M54 118.7c35-15.2 58.3-25.3 70-30.2 33.3-13.9 40.2-16.3 44.7-16.4 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3.2 1 .4 3.1.2 4.8-1.8 19.3-9.7 66.1-13.7 87.7-1.7 9.1-5 12.2-8.2 12.5-7 .6-12.3-4.6-19-9-10.5-6.9-16.5-11.2-26.7-17.9-11.8-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1s-1.7-.4-2.4-.2c-1 .2-17.9 11.4-50.6 33.5-4.8 3.3-9.1 4.9-13 4.8-4.3-.1-12.5-2.4-18.6-4.4-7.5-2.4-13.5-3.7-13-7.9.3-2.2 3.3-4.4 8.8-6.5z"
      />
    </svg>
  )
}

export function IconoCalendar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="10" width="28" height="28" rx="2" fill="#fff" />
      <path fill="#4285f4" d="M38 10H10v8h28z" />
      <path fill="#ea4335" d="M10 10h8v28h-8z" />
      <path fill="#34a853" d="M10 30h28v8H10z" />
      <path fill="#fbbc04" d="M30 10h8v28h-8z" />
      <rect x="18" y="18" width="12" height="12" fill="#fff" />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#4285f4"
        fontFamily="Arial, sans-serif"
      >
        31
      </text>
    </svg>
  )
}
