'use client'

// Vista 2 — "¿Cómo voy?"
//
// Compara el período actual hasta hoy contra el período equivalente anterior.
// Datos vienen de /api/reports/compare. Pro only — Free recibe un preview difuminado.

import { useEffect, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { startProCheckout } from '@/lib/upgrade-to-pro'

type ComparePeriod = 'week' | 'month' | 'year'

interface CompareData {
  period: ComparePeriod
  current: {
    range: { start: string; end: string }
    income: number
    expenses: number
    net: number
    byCategory: Record<string, { income: number; expenses: number }>
  }
  previous: {
    range: { start: string; end: string }
    income: number
    expenses: number
    net: number
    byCategory: Record<string, { income: number; expenses: number }>
  }
}

const PERIOD_LABELS: Record<ComparePeriod, string> = {
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
}

const VS_PHRASES: Record<ComparePeriod, string> = {
  week: 'la semana pasada',
  month: 'el mismo período del mes pasado',
  year: 'el mismo período del año pasado',
}

const SHORT_VS: Record<ComparePeriod, string> = {
  week: 'esta semana',
  month: 'este mes',
  year: 'este año',
}

interface MetricRowProps {
  label: 'Ingresos' | 'Gastos' | 'Neto'
  current: number
  previous: number
  period: ComparePeriod
}

function MetricRow({ label, current, previous, period }: MetricRowProps) {
  const delta = current - previous
  const pctRaw = previous !== 0 ? (delta / Math.abs(previous)) * 100 : (current === 0 ? 0 : 100)
  const pctRounded = Math.round(pctRaw)

  const higherIsBetter = label !== 'Gastos'
  const isImproved = higherIsBetter ? delta > 0 : delta < 0
  const isSame = delta === 0

  // Pill (background + text) según trend
  const trendCls = isSame
    ? 'bg-brand-chip text-brand-mid'
    : isImproved
      ? 'bg-income-bg text-income-text'
      : 'bg-expense-bg text-expense-text'

  // Texto natural
  let context = ''
  if (delta === 0 && previous === 0) {
    context = `Sin actividad ${SHORT_VS[period]} ni en el período anterior.`
  } else if (delta === 0) {
    context = `Igual que en ${VS_PHRASES[period]}.`
  } else {
    const absAmount = formatCurrency(Math.abs(delta))
    if (label === 'Ingresos') {
      context = delta > 0
        ? `Ganaste ${absAmount} más que en ${VS_PHRASES[period]}.`
        : `Ganaste ${absAmount} menos que en ${VS_PHRASES[period]}.`
    } else if (label === 'Gastos') {
      context = delta > 0
        ? `Gastaste ${absAmount} más que en ${VS_PHRASES[period]}.`
        : `Gastaste ${absAmount} menos que en ${VS_PHRASES[period]}.`
    } else {
      context = delta > 0
        ? `Tu neto subió ${absAmount} vs ${VS_PHRASES[period]}.`
        : `Tu neto bajó ${absAmount} vs ${VS_PHRASES[period]}.`
    }
  }

  // Color del monto principal
  const amountCls =
    label === 'Ingresos' ? 'text-income-text' :
    label === 'Gastos'   ? 'text-expense-text' :
    current >= 0         ? 'text-income-text' : 'text-expense-text'

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 shadow-sm border border-brand-border">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-mid">
          {label}
        </p>
        {!isSame && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${trendCls}`}>
            {isImproved ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 15 12 9 18 15" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {Math.abs(pctRounded)}%
          </span>
        )}
      </div>
      <p className={`text-xl font-bold leading-none ${amountCls}`}>
        {label === 'Neto' && current < 0 ? '−' : ''}{formatCurrency(Math.abs(current))}
      </p>
      <p className="text-xs leading-relaxed text-brand-mid">{context}</p>
    </div>
  )
}

interface CategoryDeltaRowProps {
  category: string
  currentAmount: number
  previousAmount: number
  kind: 'ingreso' | 'gasto'
  isLast?: boolean
}

function CategoryDeltaRow({ category, currentAmount, previousAmount, kind, isLast }: CategoryDeltaRowProps) {
  const delta = currentAmount - previousAmount
  const isUp = delta > 0
  const higherIsBetter = kind === 'ingreso'
  const isImproved = higherIsBetter ? isUp : !isUp && delta !== 0
  const isSame = delta === 0
  const deltaCls = isSame ? 'text-brand-mid' : isImproved ? 'text-income-text' : 'text-expense-text'

  return (
    <div className={`flex items-center justify-between py-2.5 ${isLast ? '' : 'border-b border-brand-border'}`}>
      <span className="text-sm truncate min-w-0 flex-1 pr-2 text-brand">
        {category}
      </span>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs tabular-nums text-brand-mid">
          {formatCurrency(currentAmount)}
        </span>
        {!isSame && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${deltaCls}`}>
            {isUp ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  )
}

interface CompareViewProps {
  plan: 'free' | 'pro'
}

export function CompareView({ plan }: CompareViewProps) {
  const [period, setPeriod] = useState<ComparePeriod>('month')
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (plan !== 'pro') return
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/compare?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: CompareData | null) => {
        if (cancelled) return
        setData(j)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [plan, period])

  // Free: preview difuminado + CTA
  if (plan === 'free') {
    return <FreePreview />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de período */}
      <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
        {(Object.keys(PERIOD_LABELS) as ComparePeriod[]).map(p => {
          const active = period === p
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={[
                'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors',
                active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
              ].join(' ')}
            >
              {PERIOD_LABELS[p]}
            </button>
          )
        })}
      </div>

      {loading || !data ? (
        <p className="text-sm text-center py-8 text-brand-mid">
          {loading ? 'Cargando comparación...' : 'No se pudo cargar la comparación.'}
        </p>
      ) : (
        <>
          <MetricRow label="Ingresos" current={data.current.income}   previous={data.previous.income}   period={period} />
          <MetricRow label="Gastos"   current={data.current.expenses} previous={data.previous.expenses} period={period} />
          <MetricRow label="Neto"     current={data.current.net}      previous={data.previous.net}      period={period} />
          <CategoryBreakdown current={data.current.byCategory} previous={data.previous.byCategory} />
        </>
      )}
    </div>
  )
}

function CategoryBreakdown({
  current, previous,
}: {
  current: Record<string, { income: number; expenses: number }>
  previous: Record<string, { income: number; expenses: number }>
}) {
  type Row = { category: string; cur: number; prev: number; delta: number }
  const allCats = new Set([...Object.keys(current), ...Object.keys(previous)])
  const incomeRows: Row[] = []
  const expenseRows: Row[] = []

  for (const cat of allCats) {
    const c = current[cat] ?? { income: 0, expenses: 0 }
    const p = previous[cat] ?? { income: 0, expenses: 0 }
    if (c.income > 0 || p.income > 0) {
      incomeRows.push({ category: cat, cur: c.income, prev: p.income, delta: c.income - p.income })
    }
    if (c.expenses > 0 || p.expenses > 0) {
      expenseRows.push({ category: cat, cur: c.expenses, prev: p.expenses, delta: c.expenses - p.expenses })
    }
  }

  incomeRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  expenseRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  if (incomeRows.length === 0 && expenseRows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 text-center border border-brand-border">
        <p className="text-xs text-brand-mid">
          Sin movimientos en ninguno de los dos períodos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-border">
      <h3 className="text-[10px] font-bold uppercase tracking-wider px-4 pt-3 pb-2 text-brand-mid">
        Desglose por categoría
      </h3>

      {incomeRows.length > 0 && (
        <CategorySection
          label="Ingresos"
          variant="ingreso"
          rows={incomeRows}
        />
      )}

      {expenseRows.length > 0 && (
        <CategorySection
          label="Gastos"
          variant="gasto"
          rows={expenseRows}
          showDivider={incomeRows.length > 0}
        />
      )}
    </div>
  )
}

function CategorySection({
  label, variant, rows, showDivider,
}: {
  label: string
  variant: 'ingreso' | 'gasto'
  rows: Array<{ category: string; cur: number; prev: number; delta: number }>
  showDivider?: boolean
}) {
  const headerCls = variant === 'ingreso'
    ? 'bg-income-bg text-income-text'
    : 'bg-expense-bg text-expense-text'
  return (
    <div className={showDivider ? 'border-t border-brand-border' : ''}>
      <div className={`flex items-center gap-2 px-4 py-2 ${headerCls}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="px-4">
        {rows.map((r, i) => (
          <CategoryDeltaRow
            key={`${variant}-${r.category}`}
            category={r.category}
            currentAmount={r.cur}
            previousAmount={r.prev}
            kind={variant}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function FreePreview() {
  const fakeData: CompareData = {
    period: 'month',
    current: {
      range: { start: '', end: '' },
      income: 12450, expenses: 8230, net: 4220,
      byCategory: {
        'Ventas': { income: 12450, expenses: 0 },
        'Ingredientes': { income: 0, expenses: 4500 },
        'Servicios básicos': { income: 0, expenses: 1850 },
      },
    },
    previous: {
      range: { start: '', end: '' },
      income: 10800, expenses: 7900, net: 2900,
      byCategory: {
        'Ventas': { income: 10800, expenses: 0 },
        'Ingredientes': { income: 0, expenses: 4200 },
        'Servicios básicos': { income: 0, expenses: 1700 },
      },
    },
  }

  return (
    <div className="relative">
      {/* Capa difuminada con datos fake */}
      <div className="fz-blur-preview">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
            {(['Semana', 'Mes', 'Año']).map(label => (
              <div
                key={label}
                className={[
                  'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 flex items-center justify-center',
                  label === 'Mes' ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                ].join(' ')}
              >
                {label}
              </div>
            ))}
          </div>
          <MetricRow label="Ingresos" current={fakeData.current.income}   previous={fakeData.previous.income}   period="month" />
          <MetricRow label="Gastos"   current={fakeData.current.expenses} previous={fakeData.previous.expenses} period="month" />
          <MetricRow label="Neto"     current={fakeData.current.net}      previous={fakeData.previous.net}      period="month" />
          <CategoryBreakdown current={fakeData.current.byCategory} previous={fakeData.previous.byCategory} />
        </div>
      </div>

      {/* Overlay con CTA */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-xs text-center flex flex-col gap-3 items-center border border-brand-light fz-shadow-cta">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-chip text-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p className="font-bold text-base text-brand">Compara contra tu pasado</p>
          <p className="text-xs leading-relaxed text-brand-mid">
            Mira si vas mejor o peor que la semana, mes o año anterior — con desglose por categoría.
          </p>
          <button
            type="button"
            onClick={() => { void startProCheckout() }}
            className="text-sm font-bold py-2 px-4 rounded-xl text-white inline-block bg-brand"
          >
            Activar Pro
          </button>
        </div>
      </div>
    </div>
  )
}
