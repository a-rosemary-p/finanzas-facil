'use client'

/**
 * MetricsCard — el card de "[Periodo] · Resumen" en /inicio.
 *
 * Llama `/api/reports/compare?period=X`. Si previous es null (period=global)
 * NO se muestra delta, solo el sparkline.
 *
 * Variants de color:
 *   income   — text-income-text  + bg-income-bg   (Ingresos)
 *   expense  — text-expense-text + bg-expense-bg  (Gastos)
 *   neto     — text-brand        + bg-income-bg   (Neto — color "brand"
 *              sobre fondo income porque visualmente lee como "balance ok")
 *
 * Mostrar/ocultar delta:
 *   - both === 0   → null
 *   - previous = 0 && current > 0 → "Nuevo"
 *   - resto        → ±X% vs label
 */

import { useEffect, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { IconWallet, IconReceipt, IconChartPieSlice } from '@/components/icons'
import { Sparkline } from './sparkline'
import { PeriodDropdown, periodDisplayLabel, type RegistrosPeriod } from './period-dropdown'

type CardVariant = 'income' | 'expense'

const VARIANT_CLASSES: Record<CardVariant, string> = {
  income:  'text-income-text bg-income-bg',
  expense: 'text-expense-text bg-expense-bg',
}

interface CompareResponse {
  period: string
  current:  { income: number; expenses: number; net: number }
  previous: { income: number; expenses: number; net: number } | null
  sparkline?: {
    income:   number[]
    expenses: number[]
    net:      number[]
  }
}

const PREV_LABEL: Record<RegistrosPeriod, string> = {
  global: '',
  year:   'vs año previo',
  month:  'vs 30 días previos',
  week:   'vs 7 días previos',
  today:  'vs un día normal',
}

interface Props {
  period: RegistrosPeriod
  onPeriodChange: (next: RegistrosPeriod) => void
  refreshKey?: number
}

export function MetricsCard({ period, onPeriodChange, refreshKey = 0 }: Props) {
  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/compare?period=${period}`)
      .then(r => r.json())
      .then((d: CompareResponse) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [period, refreshKey])

  const current  = data?.current  ?? { income: 0, expenses: 0, net: 0 }
  const previous = data?.previous ?? null
  const spark    = data?.sparkline
  const comparable = period !== 'global'

  return (
    <div className="rounded-2xl bg-white border border-brand-border shadow-fz-2 relative z-10">
      {/* Header con label + dropdown */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="text-[15px] font-bold text-ink-900">
          {periodDisplayLabel(period)}
          <span className="font-normal mx-1.5 text-ink-300">·</span>
          <span className="font-normal text-ink-500">Resumen</span>
        </div>
        <PeriodDropdown value={period} onChange={onPeriodChange} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
        <SubCard
          label="Ingresos"
          icon={<IconWallet size={20} />}
          value={current.income}
          previousValue={previous?.income ?? 0}
          comparable={comparable}
          sparkPoints={spark?.income}
          variant="income"
          previousLabel={PREV_LABEL[period]}
          loading={loading}
        />
        <SubCard
          label="Gastos"
          icon={<IconReceipt size={20} />}
          value={current.expenses}
          previousValue={previous?.expenses ?? 0}
          comparable={comparable}
          sparkPoints={spark?.expenses}
          variant="expense"
          previousLabel={PREV_LABEL[period]}
          loading={loading}
        />
        <SubCard
          label="Neto"
          icon={<IconChartPieSlice size={20} />}
          value={current.net}
          previousValue={previous?.net ?? 0}
          comparable={comparable}
          sparkPoints={spark?.net}
          // Neto pinta verde si >= 0, rojo si negativo. Antes era siempre verde
          // (hardcoded a 'neto' variant) — bug de v0.281 que ocultaba meses
          // donde el neto era pérdida.
          variant={current.net >= 0 ? 'income' : 'expense'}
          previousLabel={PREV_LABEL[period]}
          loading={loading}
        />
      </div>
    </div>
  )
}

interface SubCardProps {
  label: string
  icon: React.ReactNode
  value: number
  previousValue: number
  comparable: boolean
  sparkPoints?: number[]
  variant: CardVariant
  previousLabel: string
  loading: boolean
}

function SubCard({
  label, icon, value, previousValue, comparable, sparkPoints, variant,
  previousLabel, loading,
}: SubCardProps) {
  const delta = comparable ? computeDelta(value, previousValue) : null
  const showDeltaBlock = !!delta
  const hasSpark = !!sparkPoints && sparkPoints.length >= 2

  return (
    <div className={`fz-subcard ${VARIANT_CLASSES[variant]}`}>
      <div className="mb-1.5">{icon}</div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-75">
        {label}
      </div>
      <div className="text-[15px] font-bold tabular-nums leading-tight mt-0.5 tracking-[-0.02em]">
        {loading ? '—' : formatCurrency(value)}
      </div>

      {hasSpark && !loading && (
        <div className="mt-1.5">
          <Sparkline points={sparkPoints!} />
        </div>
      )}
      {showDeltaBlock && !loading && delta && (
        <div className="text-[8.5px] font-semibold text-center mt-1 leading-tight opacity-70">
          {delta.kind === 'new'
            ? `Nuevo · ${previousLabel.replace('vs ', '')}`
            : `${delta.pct > 0 ? '+' : ''}${Math.round(delta.pct)}% ${previousLabel}`}
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
