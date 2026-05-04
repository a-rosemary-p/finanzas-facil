/**
 * Sparkline para el card de métricas — curva real basada en data del período.
 *
 * El color se hereda del padre via `currentColor` (set con clases tipo
 * `text-income-text` / `text-expense-text` / `text-brand`). Sin prop de color
 * inline.
 *
 * Path = polyline simple (sin curvas suavizadoras). En 90×10 px las Bezier
 * no aportan nada visualmente y meten ruido.
 */

interface SparklineProps {
  points: number[]
}

const VIEW_W = 90
const VIEW_H = 10
const PADDING = 1

export function Sparkline({ points }: SparklineProps) {
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min
  const usableH = VIEW_H - PADDING * 2

  // Si todos los buckets son idénticos (incluido todos = 0), trazamos una
  // línea horizontal centrada — más honesto que "subir o bajar artificialmente".
  const flat = range === 0
  const baselineY = VIEW_H - PADDING - usableH / 2

  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * VIEW_W
      const y = flat
        ? baselineY
        : VIEW_H - PADDING - ((v - min) / range) * usableH
      const cmd = i === 0 ? 'M' : 'L'
      return `${cmd} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block w-full fz-sparkline"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
