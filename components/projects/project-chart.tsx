'use client'

/**
 * Chart simple para detalle de proyecto (v0.5).
 *
 * Por bucket (mes o semana) muestra dos barras lado a lado: ingresos (verde
 * brand) vs gastos (rojo danger). Sin chart library — CSS puro. Útil para
 * "veo la tendencia rápido"; si en futuro queremos animación o tooltips,
 * portar a recharts (ya está en dependencias por /reportes).
 */

import { formatCurrency } from '@/lib/utils'
import type { ProjectTimeseriesPoint } from '@/types'

interface ProjectChartProps {
  granularity: 'week' | 'month'
  points: ProjectTimeseriesPoint[]
}

export function ProjectChart({ granularity, points }: ProjectChartProps) {
  if (points.length === 0) return null

  // Máximo para escalar las barras.
  let max = 0
  for (const p of points) {
    if (p.income > max) max = p.income
    if (p.expenses > max) max = p.expenses
  }
  if (max === 0) max = 1 // evita división por cero

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-brand-border flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase text-brand-mid">
          Evolución · {granularity === 'week' ? 'por semana' : 'por mes'}
        </p>
        <div className="flex gap-3 text-[10px] text-brand-mid">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block bg-brand" />
            Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block bg-danger" />
            Gastos
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-24">
        {points.map(p => {
          const inH = Math.round((p.income / max) * 100)
          const exH = Math.round((p.expenses / max) * 100)
          return (
            <div key={p.bucketStart} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 h-full">
                <div
                  className="w-2.5 bg-brand rounded-t"
                  style={{ height: `${inH}%`, minHeight: p.income > 0 ? '2px' : 0 }}
                  title={`Ingresos: ${formatCurrency(p.income)}`}
                />
                <div
                  className="w-2.5 bg-danger rounded-t"
                  style={{ height: `${exH}%`, minHeight: p.expenses > 0 ? '2px' : 0 }}
                  title={`Gastos: ${formatCurrency(p.expenses)}`}
                />
              </div>
              <p className="text-[9px] text-brand-mid">{formatBucketLabel(p.bucketStart, granularity)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatBucketLabel(ymd: string, granularity: 'week' | 'month'): string {
  if (granularity === 'month') {
    // 'YYYY-MM-01' → 'MMM yy' (ej. 'may 26').
    const [y, m] = ymd.split('-')
    const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${monthNames[Number(m) - 1]} ${y!.slice(2)}`
  }
  // week: 'YYYY-MM-DD' → 'DD MMM'
  const [, m, d] = ymd.split('-')
  const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${monthNames[Number(m) - 1]}`
}
