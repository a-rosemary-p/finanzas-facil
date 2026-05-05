'use client'

/**
 * PeriodChart — gráfica única de Ingresos vs Gastos vs Neto en el tiempo
 * para la pestaña "Este período" de /reportes (v0.29).
 *
 * Sustituye:
 *  - El sparkline pequeño que vivía en cada tarjeta (ahora cada tarjeta solo
 *    muestra número + flecha %Δ; la curva la pone esta gráfica grande)
 *  - La tabla de movimientos del período (movida a /movimientos)
 *  - El desglose por categoría (vive ahora solo en PDF/Excel)
 *
 * Toggles de serie: el user puede aislar Ingresos / Gastos / Neto. Los 3
 * encendidos por default. Al menos 1 debe estar activo (no permitimos vacío).
 */

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { PeriodMode } from '@/lib/periods'

type Series = 'income' | 'expenses' | 'net'

interface Bucket {
  label: string
  start: string
  end: string
  income: number
  expenses: number
  net: number
}

interface Props {
  buckets: Bucket[]
  loading: boolean
  mode: PeriodMode
}

// Recharts requiere literales JS — var() de CSS no resuelve dentro de los
// props de los SVG primitives. Mantenemos hex en sync con globals.css.
const COLORS = {
  income:   '#578466',  // var(--brand)
  expenses: '#D0481A',  // var(--danger)
  net:      '#2E5266',  // var(--neto-strong) — slate-petróleo, ver globals.css
} as const

const SERIES_LABEL: Record<Series, string> = {
  income: 'Ingresos',
  expenses: 'Gastos',
  net: 'Neto',
}

const SERIES_TEXT_CLS: Record<Series, string> = {
  income:   'text-brand',
  expenses: 'text-danger',
  net:      'text-neto-strong',
}

export function PeriodChart({ buckets, loading, mode }: Props) {
  // Single-select: solo una serie visible a la vez. Cada toggle reemplaza
  // la activa. El default es 'income'. Esto reemplaza el multi-select que
  // saturaba visualmente (3 barras + 1 línea en mobile se veía denso).
  const [active, setActive] = useState<Series>('income')

  const fmtTick = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  const isEmpty = !loading && buckets.length === 0
  const noData = !loading && buckets.every(b => b.income === 0 && b.expenses === 0)

  return (
    <div className="bg-white rounded-2xl border border-brand-border p-3 flex flex-col gap-2">
      {/* Toggle de serie — single-select. Click reemplaza la activa. */}
      <div className="flex gap-1 p-1 rounded-lg bg-brand-chip border border-brand-border">
        {(['income', 'expenses', 'net'] as Series[]).map(s => {
          const isOn = active === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={[
                'flex-1 text-xs font-bold rounded-md min-h-[32px] px-2 transition-colors flex items-center justify-center gap-1.5',
                isOn ? `bg-white shadow-fz-1 ${SERIES_TEXT_CLS[s]}` : 'bg-transparent text-brand-mid',
              ].join(' ')}
              aria-pressed={isOn}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: isOn ? COLORS[s] : 'var(--brand-border)' }}
              />
              {SERIES_LABEL[s]}
            </button>
          )
        })}
      </div>

      {/* Chart o estado vacío */}
      {loading ? (
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid">Cargando...</p>
        </div>
      ) : isEmpty || noData ? (
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid text-center px-4">
            Sin movimientos en este período.
          </p>
        </div>
      ) : (
        <div className="fz-trend-chart-h">
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--ink-100)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--ink-300)' }}
                axisLine={false}
                tickLine={false}
                interval={mode === 'month' ? 'preserveStartEnd' : 0}
                angle={buckets.length > 8 ? -30 : 0}
                textAnchor={buckets.length > 8 ? 'end' : 'middle'}
                height={buckets.length > 8 ? 40 : 24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--ink-300)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtTick}
                width={44}
              />
              <Tooltip
                cursor={{ fill: 'var(--brand-chip)', opacity: 0.5 }}
                contentStyle={{
                  background: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(14,23,17,0.10)',
                }}
                formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name ?? '')]}
                labelStyle={{ color: 'var(--brand)', fontWeight: 600, marginBottom: 4 }}
              />
              {/* Todas las series renderizan como barras (incluyendo Neto) —
               * más consistente; el toggle es single-select, máximo 1 a la vez. */}
              {active === 'income' && (
                <Bar dataKey="income" name="Ingresos" fill={COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={32} />
              )}
              {active === 'expenses' && (
                <Bar dataKey="expenses" name="Gastos" fill={COLORS.expenses} radius={[4, 4, 0, 0]} maxBarSize={32} />
              )}
              {active === 'net' && (
                <Bar dataKey="net" name="Neto" fill={COLORS.net} radius={[4, 4, 0, 0]} maxBarSize={32} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
