import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

/**
 * Genera los íconos PNG de la app instalada, a partir del mismo dibujo que
 * `public/logo.svg`: el tilde verde con la chispa dorada.
 *
 * Se hace a mano, sin librerías de imágenes, por dos motivos: no sumar una
 * dependencia para algo que se corre una vez cada tanto, y que los íconos
 * queden reproducibles — si mañana cambian los colores de la marca, se tocan
 * acá y se vuelve a correr.
 *
 *     bun run iconos
 */

const FONDO = [0x0d, 0x0f, 0x14] // --bg
const VERDE = [0x7d, 0xd3, 0xa0] // --accent
const DORADO = [0xff, 0xd1, 0x66] // --accent-hot

type Punto = { x: number; y: number }

/** Distancia de un punto al segmento a-b. Sirve para dibujar líneas gruesas. */
function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const largo = dx * dx + dy * dy
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Rombo de cuatro puntas cóncavas: la chispa del logo. */
function dentroDeChispa(p: Punto, centro: Punto, radio: number): boolean {
  const dx = Math.abs(p.x - centro.x) / radio
  const dy = Math.abs(p.y - centro.y) / radio
  if (dx > 1 || dy > 1) return false
  // Exponente < 1 hunde los lados y deja las puntas afiladas.
  return Math.pow(dx, 0.55) + Math.pow(dy, 0.55) <= 1
}

/**
 * @param tam       lado en píxeles
 * @param escala    cuánto ocupa el dibujo (1 = todo el cuadro)
 * @param redondear esquinas redondeadas. Las maskable van cuadradas porque
 *                  el sistema les aplica su propia forma encima.
 */
function dibujar(tam: number, escala: number, redondear: boolean): Buffer {
  const px = Buffer.alloc(tam * tam * 4)
  const c = tam / 2
  const r = tam * escala

  // El tilde y la chispa, en coordenadas relativas al centro.
  const tilde: Punto[] = [
    { x: c - r * 0.42, y: c + r * 0.02 },
    { x: c - r * 0.12, y: c + r * 0.32 },
    { x: c + r * 0.42, y: c - r * 0.3 },
  ]
  const grosor = r * 0.13
  const chispa = { x: c + r * 0.38, y: c - r * 0.42 }
  const radioChispa = r * 0.16
  const radioEsquina = redondear ? tam * 0.22 : 0

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const p = { x: x + 0.5, y: y + 0.5 }
      const i = (y * tam + x) * 4

      // Fuera de las esquinas redondeadas: transparente.
      if (radioEsquina > 0 && fueraDeEsquina(p, tam, radioEsquina)) continue

      let color = FONDO
      const d = Math.min(
        distanciaASegmento(p, tilde[0], tilde[1]),
        distanciaASegmento(p, tilde[1], tilde[2]),
      )
      if (d <= grosor / 2) color = VERDE
      else if (dentroDeChispa(p, chispa, radioChispa)) color = DORADO

      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
  return px
}

function fueraDeEsquina(p: Punto, tam: number, radio: number): boolean {
  const cx = p.x < radio ? radio : p.x > tam - radio ? tam - radio : p.x
  const cy = p.y < radio ? radio : p.y > tam - radio ? tam - radio : p.y
  return Math.hypot(p.x - cx, p.y - cy) > radio
}

// ---------- Armado del PNG ----------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

function armarPng(tam: number, px: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0)
  ihdr.writeUInt32BE(tam, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  // Cada fila lleva adelante un byte de filtro; 0 = sin filtro.
  const filas = Buffer.alloc(tam * (tam * 4 + 1))
  for (let y = 0; y < tam; y++) {
    filas[y * (tam * 4 + 1)] = 0
    px.copy(filas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- Salida ----------

mkdirSync('public/iconos', { recursive: true })

const salidas = [
  { archivo: 'icono-192.png', tam: 192, escala: 0.34, redondear: true },
  { archivo: 'icono-512.png', tam: 512, escala: 0.34, redondear: true },
  // Maskable: el dibujo va más chico porque el sistema le recorta las puntas.
  { archivo: 'icono-512-maskable.png', tam: 512, escala: 0.26, redondear: false },
  { archivo: 'apple-touch-icon.png', tam: 180, escala: 0.34, redondear: false },
]

for (const s of salidas) {
  const png = armarPng(s.tam, dibujar(s.tam, s.escala, s.redondear))
  writeFileSync(`public/iconos/${s.archivo}`, png)
  // eslint-disable-next-line no-console -- es un script de línea de comandos
  console.log(`${s.archivo.padEnd(28)} ${s.tam}x${s.tam}  ${(png.length / 1024).toFixed(1)} KB`)
}
