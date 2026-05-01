'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/use-auth'
import { AppHeader } from '@/components/app-header'
import { formatCurrency } from '@/lib/utils'
import { MovementCard } from '@/components/entries/entry-card'
import { CompareView } from '@/components/reports/compare-view'
import {
  type PeriodMode, type PeriodSelection,
  todayPeriod, prevPeriod, nextPeriod, periodRange,
  periodLabel, periodSlug,
  isAccessibleForFree, isFuturePeriod,
} from '@/lib/periods'
import type { Movement } from '@/types'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'

// react-pdf solo client-side
const PdfDownloadButton = dynamic(
  () => import('@/components/reports/pdf-download-button'),
  { ssr: false, loading: () => (
    <div className="w-full py-3.5 rounded-xl flex items-center justify-center bg-brand-chip border border-brand-border">
      <p className="text-sm text-brand-mid">Preparando PDF...</p>
    </div>
  )}
)

// recharts (~100KB) cargado solo cuando el user abre Vista 3
const TrendView = dynamic(
  () => import('@/components/reports/trend-view'),
  { ssr: false, loading: () => (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-brand-border">
      <p className="text-sm text-brand-mid">Cargando gráfica...</p>
    </div>
  )}
)

// Excel button — la lib xlsx (~700KB) se importa async DENTRO del handler, así
// que cargar el componente no aumenta el bundle inicial.
const ExcelDownloadButton = dynamic(
  () => import('@/components/reports/excel-download-button'),
  { ssr: false }
)

type Tab = 'periodo' | 'comparar' | 'tendencia'

const PERIOD_MODE_LABELS: Record<PeriodMode, string> = {
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
}

export default function ReportesPage() {
  const { profile, loading: authLoading } = useAuth()
  const plan = profile?.plan ?? 'free'

  const [tab, setTab] = useState<Tab>('periodo')
  // Free siempre arranca en mode='month'; Pro también default mes (más útil).
  const [period, setPeriod] = useState<PeriodSelection>(() => todayPeriod('month'))
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  // Inversiones excluidas por default (igual que el dashboard) — toggle abajo.
  const [includeInvestments, setIncludeInvestments] = useState(false)

  // ── Datos derivados del período ─────────────────────────────────────────
  const range = useMemo(() => periodRange(period), [period])
  const label = useMemo(() => periodLabel(period), [period])
  const slug  = useMemo(() => periodSlug(period), [period])

  // Desactivar arrows
  const atFuture = useMemo(() => isFuturePeriod(nextPeriod(period)), [period])
  const atFreeEarliest = useMemo(
    () => plan === 'free' && period.mode === 'month' && !isAccessibleForFree(prevPeriod(period)),
    [plan, period]
  )

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchPeriod = useCallback(async (p: PeriodSelection) => {
    setLoading(true)
    try {
      const r = periodRange(p)
      // Free + month: usar ?month= (back-compat). Pro o non-month: ?from=&to=.
      const query = (plan === 'free' && p.mode === 'month')
        ? `month=${r.start.slice(0, 7)}`
        : `from=${r.start}&to=${r.end}`
      const res = await fetchWithAuthRetry(`/api/reports/movements?${query}`)
      if (!res.ok) {
        setMovements([])
        setBlocked(false)
        return
      }
      const json = await res.json() as {
        movements: Movement[]; truncated?: boolean; blocked?: boolean
      }
      setMovements(json.movements ?? [])
      setBlocked(Boolean(json.blocked ?? json.truncated))
    } catch (err) {
      console.error('[reportes] fetch error', err)
      setMovements([])
      setBlocked(false)
    } finally {
      setLoading(false)
    }
  }, [plan])

  useEffect(() => {
    if (profile) fetchPeriod(period)
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function changePeriod(target: PeriodSelection) {
    // Guards client-side (defense in depth; el server también valida)
    if (isFuturePeriod(target)) return
    if (plan === 'free' && !isAccessibleForFree(target)) return
    setPeriod(target)
    fetchPeriod(target)
  }

  function changeMode(mode: PeriodMode) {
    if (plan === 'free' && mode !== 'month') return
    // Conservar el anchor actual; periodRange recalcula con el modo nuevo.
    const next: PeriodSelection = { mode, anchor: period.anchor }
    // Si el mode nuevo cae en futuro (ej: el "trimestre" del anchor está en futuro),
    // ajustamos a today.
    if (isFuturePeriod(next)) {
      setPeriod(todayPeriod(mode))
      fetchPeriod(todayPeriod(mode))
    } else {
      setPeriod(next)
      fetchPeriod(next)
    }
  }

  // ── Métricas client-side ────────────────────────────────────────────────
  // Inversiones se excluyen del total a menos que el toggle esté ON.
  // Pendientes ya no llegan acá (filtrados en el server).
  let income = 0
  let expenses = 0
  let investmentCount = 0
  for (const m of movements) {
    if (m.isInvestment) {
      investmentCount++
      if (!includeInvestments) continue
    }
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  const net = income - expenses

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5 fz-pad-safe-bottom">
        {/* ── Title ── */}
        <div>
          <h1 className="font-bold text-lg text-brand">Reportes</h1>
          <p className="text-sm text-brand-mid">Resumen, comparación y tendencia de tu negocio</p>
        </div>

        {/* ── Tabs ── */}
        <div
          className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border"
          role="tablist"
        >
          {([
            { id: 'periodo',   label: 'Este período' },
            { id: 'comparar',  label: '¿Cómo voy?' },
            { id: 'tendencia', label: 'Tendencia' },
          ] as Array<{ id: Tab; label: string }>).map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id} role="tab" aria-selected={active}
                onClick={() => setTab(t.id)}
                className={[
                  'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors',
                  active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                ].join(' ')}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Selector de período (solo Vista 1 — "Este período").
              Vista 2 tiene su propio selector interno; Vista 3 (Tendencia) siempre
              muestra los últimos N meses/semanas, no respeta el mes seleccionado ── */}
        {tab === 'periodo' && (
        <div className="flex flex-col gap-2">
          {/* Selector adaptado al modo activo */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between border border-brand-border">
            <button
              type="button"
              onClick={() => changePeriod(prevPeriod(period))}
              disabled={atFreeEarliest}
              className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30 text-brand-mid bg-brand-chip"
              aria-label="Período anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span className="font-bold text-sm sm:text-base text-center px-2 text-brand">
              {label}
            </span>

            <button
              type="button"
              onClick={() => changePeriod(nextPeriod(period))}
              disabled={atFuture}
              className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30 text-brand-mid bg-brand-chip"
              aria-label="Período siguiente"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Pills de modo de período. Free ve los demás ghosted con candado. */}
          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
            {(Object.keys(PERIOD_MODE_LABELS) as PeriodMode[]).map(mode => {
              const active = period.mode === mode
              const accessible = plan === 'pro' || mode === 'month'
              return (
                <button
                  key={mode}
                  onClick={accessible ? () => changeMode(mode) : undefined}
                  disabled={!accessible}
                  aria-label={accessible ? PERIOD_MODE_LABELS[mode] : `${PERIOD_MODE_LABELS[mode]} (Pro)`}
                  className={[
                    'flex-1 text-[11px] font-semibold rounded-lg min-h-[32px] px-1.5 transition-colors flex items-center justify-center gap-1',
                    active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                    accessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                  ].join(' ')}
                >
                  {!accessible && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                  {PERIOD_MODE_LABELS[mode]}
                </button>
              )
            })}
          </div>

          {/* Hint visible para Free en el mes más viejo */}
          {atFreeEarliest && plan === 'free' && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] px-2 text-brand-mid">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span>Tu plan Free incluye los últimos 3 meses.</span>
              <button
                type="button"
                onClick={() => { void startProCheckout() }}
                className="font-bold underline text-brand bg-transparent p-0"
              >
                Activa Pro
              </button>
            </div>
          )}
        </div>
        )}

        {/* ── Banner para mes bloqueado por cap (defense in depth) ── */}
        {blocked && plan === 'free' && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-3 bg-pending-bg border border-pending-border">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pending-text shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="text-xs leading-relaxed text-pending-text">
              <strong>Plan Base:</strong> los reportes están disponibles solo para los últimos 3 meses. Actualiza a Pro para acceder a todo tu historial.
            </div>
          </div>
        )}

        {/* ── Vista 1 — Este período ── */}
        {tab === 'periodo' && (
          <>
            {loading ? (
              <p className="text-sm text-center py-8 text-brand-mid">Cargando movimientos...</p>
            ) : (
              <>
                {/* Summary cards — variants: ingreso (income), gasto (expense),
                    neto (income si >= 0, expense si < 0). Usan las clases de variant. */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Ingresos', value: income,           variant: 'income'  as const, sign: '+' },
                    { label: 'Gastos',   value: expenses,         variant: 'expense' as const, sign: '−' },
                    {
                      label: 'Neto',
                      value: Math.abs(net),
                      variant: (net >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                      sign: net >= 0 ? '+' : '−',
                    },
                  ].map(c => {
                    const cls = c.variant === 'income'
                      ? 'bg-income-bg border-income-border text-income-text'
                      : 'bg-expense-bg border-expense-border text-expense-text'
                    return (
                      <div key={c.label} className={`rounded-xl p-3 flex flex-col gap-1 border ${cls}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide">{c.label}</p>
                        <p className="text-sm font-bold leading-tight">
                          {c.sign}{formatCurrency(c.value)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Toggle de inversiones — visible solo si hay inversiones */}
                {investmentCount > 0 && (
                  <label className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 cursor-pointer border border-brand-border">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-investment-text">
                        <polyline points="3 17 9 11 13 15 21 7" />
                        <polyline points="14 7 21 7 21 14" />
                      </svg>
                      <span className="text-xs font-medium text-brand">
                        Incluir inversiones en totales
                      </span>
                      <span className="text-[10px] text-brand-mid">
                        ({investmentCount})
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeInvestments}
                      onChange={e => setIncludeInvestments(e.target.checked)}
                      className="w-4 h-4 fz-brand-check"
                    />
                  </label>
                )}

                {/* Acciones de exportación */}
                {movements.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-brand-border">
                    <p className="text-sm text-brand-mid">
                      {blocked ? 'Este período no está disponible en tu plan.' : 'Sin movimientos en este período.'}
                    </p>
                  </div>
                ) : profile ? (
                  <div className="flex flex-col gap-2">
                    <PdfDownloadButton
                      periodSlug={slug}
                      periodLabel={label}
                      movements={movements}
                      displayName={profile.displayName}
                      giro={profile.giro}
                      includeInvestments={includeInvestments}
                    />
                    {plan === 'pro' ? (
                      <ExcelDownloadButton
                        periodSlug={slug}
                        periodLabel={label}
                        movements={movements}
                        displayName={profile.displayName}
                        giro={profile.giro}
                        includeInvestments={includeInvestments}
                      />
                    ) : (
                      // Free: botón ghosted con badge PRO — click → Stripe checkout
                      <button
                        type="button"
                        onClick={() => { void startProCheckout() }}
                        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px] transition-opacity bg-brand-chip border border-brand-border text-brand-mid opacity-85"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Descargar Excel
                        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand text-white tracking-[0.05em]">
                          PRO
                        </span>
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Movement list */}
                {movements.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide px-1 text-brand-muted">
                      Movimientos del período ({movements.length})
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      {movements.map(m => {
                        const dimmed = m.isInvestment && !includeInvestments
                        return (
                          <div key={m.id} className={dimmed ? 'opacity-65' : ''}>
                            <MovementCard
                              movement={m}
                              onUpdated={updated =>
                                setMovements(prev => prev.map(x => x.id === updated.id ? updated : x))
                              }
                              onDeleted={id =>
                                setMovements(prev => prev.filter(x => x.id !== id))
                              }
                              hideDate={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ── Vista 2 — ¿Cómo voy? ── */}
        {tab === 'comparar' && <CompareView plan={plan} />}

        {/* ── Vista 3 — Tendencia ── */}
        {tab === 'tendencia' && <TrendView plan={plan} />}
      </main>
    </div>
  )
}
