'use client'
// Loaded with dynamic({ ssr: false }) — recharts SSR es problemático y no
// queremos cargar ~100KB de chart lib en pages que no la usan.

import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { startProCheckout } from '@/lib/upgrade-to-pro'

type Granularity = 'month' | 'week'
type Series = 'income' | 'expenses' | 'net'

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

interface TrendViewProps {
  plan: 'free' | 'pro'
}

// Recharts requiere valores literales para los props de fill/stroke — no
// puede leer var(--brand) (es JS, no CSS). Mantenemos un mapa con los hex
// equivalentes que viven en el design system.
const COLORS = {
  income:   '#578466',  // brand verde — match var(--brand)
  expenses: '#D0481A',  // danger      — match var(--danger)
  net:      '#B89010',  // pending-text amarillo dorado
} as const

const SERIES_LABEL: Record<Series, string> = {
  income: 'Ingresos',
  expenses: 'Gastos',
  net: 'Neto',
}

// Equivalentes Tailwind del COLOR del fill — para los pills de toggle de serie.
const SERIES_TEXT_CLASS: Record<Series, string> = {
  income:   'text-brand',
  expenses: 'text-danger',
  net:      'text-pending-text',
}

export default function TrendView({ plan }: TrendViewProps) {
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [activeSeries, setActiveSeries] = useState<Record<Series, boolean>>({
    income: true,
    expenses: true,
    net: false,
  })
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/trend?granularity=${granularity}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: TrendData | null) => {
        if (cancelled) return
        setData(j)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [granularity])

  function toggleSeries(s: Series) {
    setActiveSeries(prev => {
      const next = { ...prev, [s]: !prev[s] }
      const anyOn = next.income || next.expenses || next.net
      if (!anyOn) return prev
      return next
    })
  }

  if (loading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center border border-brand-border">
        <p className="text-sm text-brand-mid">
          {loading ? 'Cargando tendencia...' : 'No se pudo cargar la tendencia.'}
        </p>
      </div>
    )
  }

  // Y-axis tick formatter — abrevia $1,500 → "$1.5K"
  const fmtTick = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controles — solo Pro tiene toggles de serie + granularidad */}
      {plan === 'pro' && (
        <div className="flex flex-col gap-2">
          {/* Series toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
            {(['income', 'expenses', 'net'] as Series[]).map(s => {
              const active = activeSeries[s]
              return (
                <button
                  key={s}
                  onClick={() => toggleSeries(s)}
                  className={[
                    'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors flex items-center justify-center gap-1.5',
                    active
                      ? `bg-white shadow-fz-1 ${SERIES_TEXT_CLASS[s]}`
                      : 'bg-transparent text-brand-mid',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'inline-block w-2 h-2 rounded-full',
                      // El dot del toggle reusa COLORS[] como bg dinámico —
                      // no podemos clase-ificarlo sin generar 6 utilities
                      // arbitrarias para esta sola posición.
                    ].join(' ')}
                    style={{ background: active ? COLORS[s] : 'var(--brand-border)' }}
                  />
                  {SERIES_LABEL[s]}
                </button>
              )
            })}
          </div>

          {/* Granularidad: month/week */}
          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
            {(['month', 'week'] as Granularity[]).map(g => {
              const active = granularity === g
              return (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={[
                    'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors',
                    active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                  ].join(' ')}
                >
                  {g === 'month' ? 'Mensual (12)' : 'Semanal (12)'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Gráfica.
       * NOTA: los props de Recharts (XAxis tick, Tooltip contentStyle, etc.)
       * requieren objetos JS con valores literales — no son inline `style={}`
       * de DOM, son la API de la librería. Mantenemos var() ahí porque CSS
       * vars sí resuelven en valores aplicados al SVG (heredan via fill).
       * Estos NO cuentan como inline-styles a refactorizar. */}
      <div className="bg-white rounded-2xl shadow-sm p-3 border border-brand-border">
        <div className="w-full fz-trend-chart-h">
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
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />

              {activeSeries.income && (
                <Bar dataKey="income"   name="Ingresos" fill={COLORS.income}   radius={[4, 4, 0, 0]} />
              )}
              {activeSeries.expenses && (
                <Bar dataKey="expenses" name="Gastos"   fill={COLORS.expenses} radius={[4, 4, 0, 0]} />
              )}
              {activeSeries.net && (
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Neto"
                  stroke={COLORS.net}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLORS.net }}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Info para Free — invita a Pro */}
      {plan === 'free' && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3 bg-brand-chip border border-brand-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className="text-brand shrink-0 mt-0.5">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div className="text-xs leading-relaxed text-brand-mid">
            Tu plan Free muestra los últimos 3 meses.{' '}
            <button
              type="button"
              onClick={() => { void startProCheckout() }}
              className="font-bold underline text-brand bg-transparent p-0"
            >
              Activa Pro
            </button>{' '}
            para 12 meses + vista semanal + toggles de serie.
          </div>
        </div>
      )}
    </div>
  )
}
