'use client'

/**
 * TrendChartMini — gráfica de tendencia simplificada para la pestaña
 * "¿Cómo voy?" de /reportes (v0.29). Absorbe la antigua tab "Tendencia".
 *
 * Diferencias vs el TrendView v0.281:
 *  - Sin selectores de granularidad (mes/semana) — fijo en lo que decida el padre
 *  - Sin toggles de serie — siempre muestra los 3 (income/expenses/net)
 *  - Más compacto, sin loading states elaborados
 *
 * Datos: GET /api/reports/trend?granularity=month
 */

import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'

type Granularity = 'month' | 'week'

interface Bucket {
  label: string
  start: string
  end: string
  income: number
  expenses: number
  net: number
}

interface TrendData {
  granularity: Granularity
  buckets: Bucket[]
}

const COLORS = {
  income:   '#578466',
  expenses: '#D0481A',
  net:      '#B89010',
} as const

interface Props {
  granularity: Granularity
}

export function TrendChartMini({ granularity }: Props) {
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/trend?granularity=${granularity}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: TrendData | null) => {
        if (!cancelled) {
          setData(j)
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [granularity])

  const fmtTick = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-brand-border p-3">
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-brand-border p-3">
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid">Aún no hay suficiente historia.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-border p-3">
      <div className="fz-trend-chart-h">
        <ResponsiveContainer>
          <ComposedChart data={data.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--brand-mid)' }}
              axisLine={{ stroke: 'var(--brand-border)' }}
              tickLine={false}
              interval={0}
              angle={data.buckets.length > 6 ? -30 : 0}
              textAnchor={data.buckets.length > 6 ? 'end' : 'middle'}
              height={data.buckets.length > 6 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--brand-mid)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtTick}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid var(--brand-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name ?? '')]}
              labelStyle={{ color: 'var(--brand)', fontWeight: 600 }}
            />
            <Bar dataKey="income"   name="Ingresos" fill={COLORS.income}   radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Gastos"   fill={COLORS.expenses} radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="net"
              name="Neto"
              stroke={COLORS.net}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.net }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
