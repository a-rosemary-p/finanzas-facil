'use client'

/**
 * Este período — pestaña principal de /reportes (v0.29).
 *
 * Filosofía: vista simple. 3 números con flechas %Δ vs período anterior +
 * 1 gráfica I/G/Neto en el tiempo. Sin lista de movimientos (vive en
 * /movimientos), sin desglose visual por categoría (vive en PDF/Excel).
 *
 * Datos: GET /api/reports/period-summary?mode=X&anchor=YYYY-MM-DD
 */

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { IconWallet, IconReceipt, IconChartPieSlice } from '@/components/icons'
import type { PeriodSelection, PeriodMode } from '@/lib/periods'

// Recharts cargado client-only — evita el bundle inicial del page
const PeriodChart = dynamic(
  () => import('./period-chart').then(m => m.PeriodChart),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-2xl border border-brand-border p-3">
        <div className="fz-trend-chart-h flex items-center justify-center">
          <p className="text-sm text-brand-mid">Cargando gráfica...</p>
        </div>
      </div>
    ),
  },
)

interface Totals { income: number; expenses: number; net: number }

interface SummaryResponse {
  mode: PeriodMode
  anchor: string
  current: Totals
  previous: Totals
  range: { start: string; end: string }
  previousRange: { start: string; end: string }
  buckets: Array<{ label: string; start: string; end: string; income: number; expenses: number; net: number }>
}

interface Props {
  period: PeriodSelection
}

export function EstePeriodoView({ period }: Props) {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/period-summary?mode=${period.mode}&anchor=${period.anchor}`)
      .then(r => r.json())
      .then((d: SummaryResponse) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [period.mode, period.anchor])

  const current = data?.current ?? { income: 0, expenses: 0, net: 0 }
  const previous = data?.previous ?? { income: 0, expenses: 0, net: 0 }

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjetas de números con flechas */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="Ingresos"
          icon={<IconWallet size={18} />}
          value={current.income}
          previousValue={previous.income}
          variant="income"
          loading={loading}
          higherIsBetter
        />
        <SummaryCard
          label="Gastos"
          icon={<IconReceipt size={18} />}
          value={current.expenses}
          previousValue={previous.expenses}
          variant="expense"
          loading={loading}
          higherIsBetter={false}
        />
        <SummaryCard
          label="Neto"
          icon={<IconChartPieSlice size={18} />}
          value={current.net}
          previousValue={previous.net}
          variant={current.net >= 0 ? 'income' : 'expense'}
          loading={loading}
          higherIsBetter
        />
      </div>

      {/* Gráfica I/G/Neto en el tiempo */}
      <PeriodChart
        buckets={data?.buckets ?? []}
        loading={loading}
        mode={period.mode}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

type Variant = 'income' | 'expense'

const VARIANT_BG: Record<Variant, string> = {
  income:  'bg-income-bg text-income-text',
  expense: 'bg-expense-bg text-expense-text',
}

interface SummaryCardProps {
  label: string
  icon: React.ReactNode
  value: number
  previousValue: number
  variant: Variant
  loading: boolean
  /** Para Ingresos y Neto: subir = bueno (verde). Para Gastos: subir = malo (rojo). */
  higherIsBetter: boolean
}

function SummaryCard({
  label, icon, value, previousValue, variant, loading, higherIsBetter,
}: SummaryCardProps) {
  const delta = computeDelta(value, previousValue)

  // Color de la flecha: verde si "mejoró", rojo si "empeoró".
  // Para ingresos/neto: subir es bueno. Para gastos: subir es malo.
  let trendCls = ''
  if (delta && delta.kind === 'pct') {
    const pctSign = delta.pct >= 0 ? 1 : -1
    const goodDirection = higherIsBetter ? 1 : -1
    const isImproved = pctSign === goodDirection
    trendCls = isImproved ? 'text-income-text' : 'text-expense-text'
  }

  return (
    <div className={`rounded-xl p-2.5 flex flex-col gap-1 min-h-[96px] ${VARIANT_BG[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="opacity-75">{icon}</span>
        {!loading && delta && delta.kind === 'pct' && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trendCls}`}>
            {delta.pct >= 0 ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 15 12 9 18 15" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {Math.abs(Math.round(delta.pct))}%
          </span>
        )}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-75">
        {label}
      </div>
      <div className="text-[15px] font-bold tabular-nums leading-tight tracking-[-0.02em]">
        {loading ? '—' : formatCurrency(Math.abs(value))}
      </div>
      {!loading && delta && delta.kind === 'new' && (
        <div className="text-[9px] font-semibold opacity-70">
          Nuevo · sin previo
        </div>
      )}
      {!loading && delta && delta.kind === 'pct' && (
        <div className="text-[9px] opacity-70">
          vs período anterior
        </div>
      )}
    </div>
  )
}

function computeDelta(
  current: number,
  previous: number,
): { kind: 'pct'; pct: number } | { kind: 'new' } | null {
  if (current === 0 && previous === 0) return null
  if (previous === 0) return { kind: 'new' }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return { kind: 'pct', pct }
}
