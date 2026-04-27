/**
 * Sparkline decorativo para el card de métricas.
 *
 * Decisión consciente (abr 2026): los paths son fijos para up/down/flat.
 * NO refleja datos reales — la curva es muy chica (90×10 px) para que el user
 * lea forma significativa, y queríamos evitar agregar otro fetch al mount de
 * `/registros`. La señal de "estás mejor o peor" la lleva el delta numérico
 * que va debajo. Si en el futuro queremos curva real, los datapoints saldrían
 * del endpoint /api/reports/trend (12 puntos de la última semana/mes).
 */

interface SparklineProps {
  trend: 'up' | 'down' | 'flat'
  color: string
}

const PATHS: Record<SparklineProps['trend'], string> = {
  up:   'M 0 7 C 10 9, 20 3, 30 6 S 50 9, 60 5 S 75 2, 90 4',
  down: 'M 0 3 C 10 1, 20 7, 30 4 S 50 1, 60 5 S 75 8, 90 7',
  flat: 'M 0 5 C 10 3, 20 7, 30 5 S 50 3, 60 6 S 75 7, 90 5',
}

export function Sparkline({ trend, color }: SparklineProps) {
  return (
    <svg
      viewBox="0 0 90 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: 10, opacity: 0.45 }}
    >
      <path d={PATHS[trend]} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
