'use client'

/**
 * MetricsCard — el card de "[Periodo] · Resumen" en /registros.
 *
 * Llama `/api/reports/compare?period=X` cada vez que cambia el período (o
 * cuando refreshKey cambia tras un nuevo registro). El endpoint da current +
 * previous; calculamos el delta y renderizamos sparkline up/down/flat.
 *
 * Mostrar/ocultar delta:
 *   - Si current === 0 y previous === 0 → ocultamos el bloque sparkline+delta
 *     (cuenta sin movs, no hay nada que comparar).
 *   - Si previous === 0 y current > 0 → mostramos texto "Nuevo {período}"
 *     en lugar de un porcentaje (`+∞%` se ve raro).
 *   - Resto → `±X% vs <período anterior>` con sparkline.
 */

import { useEffect, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { IconWallet, IconReceipt, IconChartPieSlice } from '@/components/icons'
import { Sparkline } from './sparkline'
import { PeriodDropdown, periodDisplayLabel, type RegistrosPeriod } from './period-dropdown'

interface CompareResponse {
  period: string
  current:  { income: number; expenses: number; net: number }
  /** null cuando period=global — no hay "antes" del historial completo. */
  previous: { income: number; expenses: number; net: number } | null
  // Sparkline series para el período actual: un valor por bucket (varía
  // según período). Ver `/api/reports/compare/route.ts:bucketRanges`.
  sparkline?: {
    income:   number[]
    expenses: number[]
    net:      number[]
  }
}

const PREV_LABEL: Record<RegistrosPeriod, string> = {
  global: '',                  // sin comparación
  year:   'vs año previo',
  month:  'vs 30 días previos',
  week:   'vs 7 días previos',
  today:  'vs un día normal',
}

interface Props {
  period: RegistrosPeriod
  onPeriodChange: (next: RegistrosPeriod) => void
  /** Bump para forzar refetch (ej. después de registrar un movimiento). */
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
  // Para period=global no hay período anterior — el sparkline + delta se
  // ocultan vía SubCard's `comparable=false`.
  const comparable = period !== 'global'

  return (
    <div
      className="rounded-2xl bg-white"
      style={{
        border: '1px solid var(--brand-border)',
        boxShadow: 'var(--sh-2)',
        position: 'relative',
        zIndex: 10, // para que el dropdown se proyecte sobre lo de abajo
      }}
    >
      {/* Header con label + dropdown */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="text-[15px] font-bold" style={{ color: 'var(--ink-900)' }}>
          {periodDisplayLabel(period)}
          <span className="font-normal mx-1.5" style={{ color: 'var(--ink-300)' }}>·</span>
          <span className="font-normal" style={{ color: 'var(--ink-500)' }}>Resumen</span>
        </div>
        <PeriodDropdown value={period} onChange={onPeriodChange} />
      </div>

      {/* 3 sub-cards */}
      <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
        <SubCard
          label="Ingresos"
          icon={<IconWallet size={20} />}
          value={current.income}
          previousValue={previous?.income ?? 0}
          comparable={comparable}
          sparkPoints={spark?.income}
          colorVar="--income-text"
          bgVar="--income-bg"
          previousLabel={PREV_LABEL[period]}
          higherIsBetter
          loading={loading}
        />
        <SubCard
          label="Gastos"
          icon={<IconReceipt size={20} />}
          value={current.expenses}
          previousValue={previous?.expenses ?? 0}
          comparable={comparable}
          sparkPoints={spark?.expenses}
          colorVar="--expense-text"
          bgVar="--expense-bg"
          previousLabel={PREV_LABEL[period]}
          higherIsBetter={false}
          loading={loading}
        />
        <SubCard
          label="Neto"
          icon={<IconChartPieSlice size={20} />}
          value={current.net}
          previousValue={previous?.net ?? 0}
          comparable={comparable}
          sparkPoints={spark?.net}
          colorVar="--brand"
          bgVar="--income-bg"
          previousLabel={PREV_LABEL[period]}
          higherIsBetter
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
  /** Si false (period=global), no se renderiza ningún delta — solo sparkline si hay. */
  comparable: boolean
  sparkPoints?: number[]
  colorVar: string  // CSS var name without `var()`
  bgVar: string
  previousLabel: string
  /** Para Ingresos y Neto: subir = bueno (verde). Para Gastos: subir = malo (rojo). */
  higherIsBetter: boolean
  loading: boolean
}

function SubCard({
  label, icon, value, previousValue, comparable, sparkPoints, colorVar, bgVar,
  previousLabel, higherIsBetter, loading,
}: SubCardProps) {
  const color = `var(${colorVar})`
  const bg    = `var(${bgVar})`

  // Lógica del delta — todas las decisiones de visibilidad viven aquí.
  // Si no es comparable (global), forzamos delta=null pero seguimos
  // mostrando el sparkline si hay data.
  const delta = comparable ? computeDelta(value, previousValue) : null

  void higherIsBetter

  const showDeltaBlock = !!delta
  const hasSpark = !!sparkPoints && sparkPoints.length >= 2

  return (
    <div
      className="rounded-xl px-2 pt-2.5 pb-2"
      style={{ background: bg, position: 'relative', overflow: 'hidden', minHeight: 96 }}
    >
      <div style={{ color, marginBottom: 6 }}>{icon}</div>
      <div
        className="text-[9px] font-bold uppercase"
        style={{ letterSpacing: '0.14em', color, opacity: 0.75 }}
      >
        {label}
      </div>
      <div
        className="text-[15px] font-bold tabular-nums leading-tight mt-0.5"
        style={{ color, letterSpacing: '-0.02em' }}
      >
        {loading ? '—' : formatCurrency(value)}
      </div>

      {/* Sparkline siempre que haya data, incluso para 'global' (sin delta). */}
      {hasSpark && !loading && (
        <div className="mt-1.5">
          <Sparkline points={sparkPoints!} color={color} />
        </div>
      )}
      {showDeltaBlock && !loading && delta && (
        <div
          className="text-[8.5px] font-semibold text-center mt-1 leading-tight"
          style={{ color, opacity: 0.7 }}
        >
          {delta.kind === 'new'
            ? `Nuevo · ${previousLabel.replace('vs ', '')}`
            : `${delta.pct > 0 ? '+' : ''}${Math.round(delta.pct)}% ${previousLabel}`}
        </div>
      )}
    </div>
  )
}

/**
 * Decide qué tipo de delta mostrar.
 *   - both === 0 → null (oculta sparkline+delta)
 *   - previous === 0 && current > 0 → 'new' (texto "Nuevo")
 *   - resto → 'pct' con porcentaje calculado
 */
function computeDelta(
  current: number,
  previous: number,
): { kind: 'pct'; pct: number } | { kind: 'new' } | null {
  if (current === 0 && previous === 0) return null
  if (previous === 0) return { kind: 'new' }
  // current puede ser negativo (neto). Calculamos signed % normal.
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return { kind: 'pct', pct }
}
