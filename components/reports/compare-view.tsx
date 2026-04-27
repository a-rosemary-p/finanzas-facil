'use client'

// Vista 2 — "¿Cómo voy?"
//
// Compara el período actual hasta hoy contra el período equivalente anterior
// (1ra mitad de mes vs 1ra mitad de mes pasado, etc.). Datos vienen de
// /api/reports/compare. Pro only — Free recibe un preview difuminado.

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

// Texto que aparece después de "vs el ..." según el período
const VS_PHRASES: Record<ComparePeriod, string> = {
  week: 'la semana pasada',
  month: 'el mismo período del mes pasado',
  year: 'el mismo período del año pasado',
}

// Para los textos de contexto en lenguaje natural
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

  // Significado de "mejor": Ingresos & Neto suben → bueno; Gastos suben → malo
  const higherIsBetter = label !== 'Gastos'
  const isImproved = higherIsBetter ? delta > 0 : delta < 0
  const isSame = delta === 0

  const trendColor = isSame ? 'var(--brand-mid)' : isImproved ? 'var(--income-text)' : 'var(--expense-text)'
  const trendBg    = isSame ? 'var(--brand-chip)' : isImproved ? 'var(--income-bg)' : 'var(--expense-bg)'

  // Texto natural — varía por métrica
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

  // Color del monto principal: ingresos verde, gastos rojo, neto según signo
  const amountColor =
    label === 'Ingresos' ? 'var(--income-text)' :
    label === 'Gastos'   ? 'var(--expense-text)' :
    current >= 0         ? 'var(--income-text)' : 'var(--expense-text)'

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 shadow-sm"
      style={{ border: '1px solid var(--brand-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-mid)' }}>
          {label}
        </p>
        {!isSame && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: trendBg, color: trendColor }}>
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
      <p className="text-xl font-bold leading-none" style={{ color: amountColor }}>
        {label === 'Neto' && current < 0 ? '−' : ''}{formatCurrency(Math.abs(current))}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-mid)' }}>{context}</p>
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
  const color = isSame ? 'var(--brand-mid)' : isImproved ? 'var(--income-text)' : 'var(--expense-text)'

  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--brand-border)' }}>
      <span className="text-sm truncate min-w-0 flex-1 pr-2" style={{ color: 'var(--brand)' }}>
        {category}
      </span>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs tabular-nums" style={{ color: 'var(--brand-mid)' }}>
          {formatCurrency(currentAmount)}
        </span>
        {!isSame && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums" style={{ color }}>
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

  // ── Free: preview difuminado + CTA ────────────────────────────────────────
  if (plan === 'free') {
    return <FreePreview />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de período de comparación */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
        {(Object.keys(PERIOD_LABELS) as ComparePeriod[]).map(p => {
          const active = period === p
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors"
              style={{
                background: active ? 'var(--brand)' : 'transparent',
                color: active ? '#fff' : 'var(--brand-mid)',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          )
        })}
      </div>

      {loading || !data ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--brand-mid)' }}>
          {loading ? 'Cargando comparación...' : 'No se pudo cargar la comparación.'}
        </p>
      ) : (
        <>
          {/* Tres métricas principales */}
          <MetricRow label="Ingresos" current={data.current.income}   previous={data.previous.income}   period={period} />
          <MetricRow label="Gastos"   current={data.current.expenses} previous={data.previous.expenses} period={period} />
          <MetricRow label="Neto"     current={data.current.net}      previous={data.previous.net}      period={period} />

          {/* Desglose por categoría — ordenado por mayor variación absoluta */}
          <CategoryBreakdown current={data.current.byCategory} previous={data.previous.byCategory} />
        </>
      )}
    </div>
  )
}

// ── Desglose por categoría — agrupado en sección Ingresos / Gastos ────────
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

  // Dentro de cada sección, ordena por mayor variación absoluta
  incomeRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  expenseRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  if (incomeRows.length === 0 && expenseRows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 text-center" style={{ border: '1px solid var(--brand-border)' }}>
        <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>
          Sin movimientos en ninguno de los dos períodos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm" style={{ border: '1px solid var(--brand-border)' }}>
      <h3 className="text-[10px] font-bold uppercase tracking-wider px-4 pt-3 pb-2"
        style={{ color: 'var(--brand-mid)' }}>
        Desglose por categoría
      </h3>

      {incomeRows.length > 0 && (
        <CategorySection
          label="Ingresos"
          color="var(--income-text)"
          bg="var(--income-bg)"
          rows={incomeRows}
          kind="ingreso"
        />
      )}

      {expenseRows.length > 0 && (
        <CategorySection
          label="Gastos"
          color="var(--expense-text)"
          bg="var(--expense-bg)"
          rows={expenseRows}
          kind="gasto"
          showDivider={incomeRows.length > 0}
        />
      )}
    </div>
  )
}

function CategorySection({
  label, color, bg, rows, kind, showDivider,
}: {
  label: string
  color: string
  bg: string
  rows: Array<{ category: string; cur: number; prev: number; delta: number }>
  kind: 'ingreso' | 'gasto'
  showDivider?: boolean
}) {
  return (
    <div style={{ borderTop: showDivider ? '1px solid var(--brand-border)' : 'none' }}>
      <div className="flex items-center gap-2 px-4 py-2"
        style={{ background: bg }}>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="px-4">
        {rows.map((r, i) => (
          <CategoryDeltaRow
            key={`${kind}-${r.category}`}
            category={r.category}
            currentAmount={r.cur}
            previousAmount={r.prev}
            kind={kind}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

// ── Preview difuminado para Free ──────────────────────────────────────────
function FreePreview() {
  // Datos placeholder con look "real" para que el preview se sienta natural.
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
      {/* Capa con datos fake difuminada */}
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
            {(['Semana', 'Mes', 'Año']).map(label => (
              <div key={label} className="flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 flex items-center justify-center"
                style={{ background: label === 'Mes' ? 'var(--brand)' : 'transparent', color: label === 'Mes' ? '#fff' : 'var(--brand-mid)' }}>
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
        <div className="bg-white rounded-2xl p-6 max-w-xs text-center flex flex-col gap-3 items-center"
          style={{ border: '1px solid var(--brand-light)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--brand-chip)', color: 'var(--brand)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p className="font-bold text-base" style={{ color: 'var(--brand)' }}>Compara contra tu pasado</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-mid)' }}>
            Mira si vas mejor o peor que la semana, mes o año anterior — con desglose por categoría.
          </p>
          <button
            type="button"
            onClick={() => { void startProCheckout() }}
            className="text-sm font-bold py-2 px-4 rounded-xl text-white inline-block"
            style={{ background: 'var(--brand)' }}
          >
            Activar Pro
          </button>
        </div>
      </div>
    </div>
  )
}
