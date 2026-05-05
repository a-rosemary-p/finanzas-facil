'use client'

/**
 * PeriodComparisonChart — gráfica de líneas overlapped del período actual vs
 * el anterior, para la pestaña "¿Cómo voy?" de /reportes (v0.29).
 *
 * Reemplaza la antigua "Tendencia" (12 meses históricos absolutos) con algo
 * más directo: ¿cómo voy hoy comparado con donde iba el período pasado?
 *
 * - Eje X: índice del bucket dentro del período (día 1, día 2... o sem 1, sem 2... etc).
 * - 2 líneas overlapped: current (color brand) y previous (gris suave).
 * - Toggle single-select arriba: Ingresos / Gastos / Neto.
 * - Los buckets se alinean por POSICIÓN (no por fecha absoluta) — es lo
 *   intuitivo: "día 1 de mayo vs día 1 de abril", "semana 1 vs semana 1".
 *
 * Si previous tiene menos buckets (Feb vs Mar), la línea de previous se corta;
 * sin extrapolación.
 */

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

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
  previousBuckets: Bucket[]
  loading: boolean
}

// Las líneas adoptan el color de la serie activa: la actual saturada, la
// anterior una versión más muted del MISMO tono (no gris universal — pega
// más cohesivo y se lee inmediato como "el mismo número, antes").
const SERIES_COLORS: Record<Series, { current: string; previous: string }> = {
  income:   { current: '#578466', previous: '#92C3A5' }, // brand / brand-light
  expenses: { current: '#D0481A', previous: '#F79366' }, // expense-text / expense-border
  net:      { current: '#2E5266', previous: '#7891A0' }, // neto-strong / neto-soft
}

const SERIES_LABEL: Record<Series, string> = {
  income:   'Ingresos',
  expenses: 'Gastos',
  net:      'Neto',
}

const SERIES_TEXT_CLS: Record<Series, string> = {
  income:   'text-income-text',
  expenses: 'text-expense-text',
  net:      'text-neto-strong',
}

// Border y bg del card cambian con la serie activa — el user pidió que
// "todo cambie de color". Mantenemos blanco el bg principal pero tintamos
// el border y el track del toggle (vía bg sutil en su contenedor).
const SERIES_CARD_CLS: Record<Series, string> = {
  income:   'border-income-border',
  expenses: 'border-expense-border',
  net:      'border-neto-soft',
}
const SERIES_TOGGLE_BG_CLS: Record<Series, string> = {
  income:   'bg-income-bg/60 border-income-border',
  expenses: 'bg-expense-bg/60 border-expense-border',
  net:      'bg-paper-2 border-neto-soft',
}

export function PeriodComparisonChart({ buckets, previousBuckets, loading }: Props) {
  const [active, setActive] = useState<Series>('income')

  // Merge por índice — el bucket N de current se empareja con el bucket N
  // de previous. Si previous tiene menos buckets, los faltantes quedan undefined
  // y recharts no dibuja ese punto (corte natural de la línea).
  const data = useMemo(() => {
    const max = Math.max(buckets.length, previousBuckets.length)
    const out: Array<{ label: string; current?: number; previous?: number }> = []
    for (let i = 0; i < max; i++) {
      const cur = buckets[i]
      const prev = previousBuckets[i]
      out.push({
        label: cur?.label ?? prev?.label ?? `${i + 1}`,
        current: cur ? cur[active] : undefined,
        previous: prev ? prev[active] : undefined,
      })
    }
    return out
  }, [buckets, previousBuckets, active])

  const fmtTick = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  const isEmpty = !loading && data.every(d => (d.current ?? 0) === 0 && (d.previous ?? 0) === 0)

  return (
    <div className={[
      'bg-white rounded-2xl border p-3 flex flex-col gap-2 transition-colors',
      SERIES_CARD_CLS[active],
    ].join(' ')}>
      {/* Toggle single-select — su track también cambia de tinte con la serie activa */}
      <div className={[
        'flex gap-1 p-1 rounded-lg border transition-colors',
        SERIES_TOGGLE_BG_CLS[active],
      ].join(' ')}>
        {(['income', 'expenses', 'net'] as Series[]).map(s => {
          const isOn = active === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={[
                'flex-1 text-xs font-bold rounded-md min-h-[32px] px-2 transition-colors',
                isOn ? `bg-white shadow-fz-1 ${SERIES_TEXT_CLS[s]}` : 'bg-transparent text-brand-mid',
              ].join(' ')}
              aria-pressed={isOn}
            >
              {SERIES_LABEL[s]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid">Cargando...</p>
        </div>
      ) : isEmpty ? (
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid text-center px-4">
            Sin movimientos para comparar todavía.
          </p>
        </div>
      ) : (
        <div className="fz-trend-chart-h">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--ink-100)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--ink-300)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--ink-300)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtTick}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: 'var(--brand-chip)', strokeWidth: 24 }}
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
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                iconType="circle"
                iconSize={7}
              />
              <Line
                type="monotone"
                dataKey="previous"
                name="Anterior"
                stroke={SERIES_COLORS[active].previous}
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="Actual"
                stroke={SERIES_COLORS[active].current}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
