'use client'

/**
 * /reportes — pestañas pulidas en v0.29.
 *
 *  - "Este período" (Free + Pro): números con flechas %Δ + gráfica I/G/Neto.
 *    SIN lista de movimientos (vive en /movimientos), SIN desglose por
 *    categoría visual (vive en PDF/Excel).
 *  - "¿Cómo voy?" (Pro only): comparativa AI-driven + tendencia. Absorbe
 *    la tab "Tendencia" anterior.
 *
 * El selector de período es uno solo — aplica a ambas tabs. Modos: semana /
 * mes / trimestre / año. Free está limitado a mes (último 3 meses).
 */

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/use-auth'
import { AppHeader } from '@/components/app-header'
import { WaveSection } from '@/components/ui/wave'
import { EstePeriodoView } from '@/components/reports/este-periodo-view'
import {
  type PeriodMode, type PeriodSelection,
  todayPeriod, prevPeriod, nextPeriod,
  periodLabel, periodSlug,
  isAccessibleForFree, isFuturePeriod,
} from '@/lib/periods'
import type { Movement } from '@/types'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { track } from '@/lib/analytics'

// La nueva ¿Cómo voy? carga AI + recharts — pesado, dynamic.
const ComoVoyView = dynamic(
  () => import('@/components/reports/como-voy-view').then(m => m.ComoVoyView),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-brand-border">
        <p className="text-sm text-brand-mid">Cargando análisis...</p>
      </div>
    ),
  },
)

// react-pdf solo client-side
const PdfDownloadButton = dynamic(
  () => import('@/components/reports/pdf-download-button'),
  { ssr: false, loading: () => (
    <div className="w-full py-3.5 rounded-xl flex items-center justify-center bg-brand-chip border border-brand-border">
      <p className="text-sm text-brand-mid">Preparando PDF...</p>
    </div>
  )}
)

const ExcelDownloadButton = dynamic(
  () => import('@/components/reports/excel-download-button'),
  { ssr: false }
)

type Tab = 'periodo' | 'comparar'

const PERIOD_MODE_LABELS: Record<PeriodMode, string> = {
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
}

export default function ReportesPage() {
  const { profile, loading: authLoading } = useAuth()
  const plan = profile?.plan ?? 'free'
  const isPro = plan === 'pro'

  const [tab, setTab] = useState<Tab>('periodo')
  const [period, setPeriod] = useState<PeriodSelection>(() => todayPeriod('month'))
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [includeInvestments, setIncludeInvestments] = useState(false)

  const label = useMemo(() => periodLabel(period), [period])
  const slug = useMemo(() => periodSlug(period), [period])

  const atFuture = useMemo(() => isFuturePeriod(nextPeriod(period)), [period])
  const atFreeEarliest = useMemo(
    () => plan === 'free' && period.mode === 'month' && !isAccessibleForFree(prevPeriod(period)),
    [plan, period],
  )

  // Movements para el export (PDF + Excel) — la página no los muestra en lista,
  // pero el PDF y Excel los siguen incluyendo.
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setLoading(true)

    // Build query params: Free + month usa el atajo `month=YYYY-MM`,
    // los demás casos pasan `from=YYYY-MM-DD&to=YYYY-MM-DD`.
    const params = (() => {
      if (period.mode === 'month' && plan === 'free') {
        return `month=${period.anchor.slice(0, 7)}`
      }
      const a = new Date(period.anchor + 'T12:00:00')
      let start: Date, end: Date
      if (period.mode === 'week') {
        const dow = a.getDay()
        const offset = dow === 0 ? -6 : 1 - dow
        start = new Date(a); start.setDate(a.getDate() + offset)
        end = new Date(start); end.setDate(start.getDate() + 6)
      } else if (period.mode === 'month') {
        start = new Date(a.getFullYear(), a.getMonth(), 1)
        end = new Date(a.getFullYear(), a.getMonth() + 1, 0)
      } else if (period.mode === 'quarter') {
        const qStart = Math.floor(a.getMonth() / 3) * 3
        start = new Date(a.getFullYear(), qStart, 1)
        end = new Date(a.getFullYear(), qStart + 3, 0)
      } else {
        start = new Date(a.getFullYear(), 0, 1)
        end = new Date(a.getFullYear(), 11, 31)
      }
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return `from=${fmt(start)}&to=${fmt(end)}`
    })()

    fetchWithAuthRetry(`/api/reports/movements?${params}`)
      .then(async res => {
        if (!res.ok) {
          if (!cancelled) {
            setMovements([])
            setBlocked(false)
            setLoading(false)
          }
          return
        }
        const json = await res.json() as { movements: Movement[]; truncated?: boolean; blocked?: boolean }
        if (!cancelled) {
          setMovements(json.movements ?? [])
          setBlocked(Boolean(json.blocked ?? json.truncated))
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('[reportes] fetch error', err)
        if (!cancelled) {
          setMovements([])
          setBlocked(false)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [profile?.id, period, plan])  // eslint-disable-line react-hooks/exhaustive-deps

  function changePeriod(target: PeriodSelection) {
    if (isFuturePeriod(target)) return
    if (plan === 'free' && !isAccessibleForFree(target)) return
    setPeriod(target)
    track('report_filter_changed', { tab, period_mode: target.mode })
  }

  function changeMode(mode: PeriodMode) {
    if (plan === 'free' && mode !== 'month') return
    const next: PeriodSelection = { mode, anchor: period.anchor }
    if (isFuturePeriod(next)) {
      setPeriod(todayPeriod(mode))
    } else {
      setPeriod(next)
    }
    track('report_filter_changed', { tab, period_mode: mode })
  }

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
          <p className="text-sm text-brand-mid">Resumen y análisis de tu negocio</p>
          <div className="mt-3">
            <WaveSection />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border" role="tablist">
          {([
            { id: 'periodo',  label: 'Este período' },
            { id: 'comparar', label: '¿Cómo voy?', proLock: !isPro },
          ] as Array<{ id: Tab; label: string; proLock?: boolean }>).map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id} role="tab" aria-selected={active}
                onClick={() => {
                  setTab(t.id)
                  track('report_filter_changed', { tab: t.id, period_mode: period.mode })
                }}
                className={[
                  'flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors flex items-center justify-center gap-1',
                  active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                ].join(' ')}
              >
                {t.proLock && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                )}
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Selector de período (compartido por ambas tabs) ── */}
        <div className="flex flex-col gap-2">
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

            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="font-bold text-sm sm:text-base text-center text-brand">
                {label}
              </span>
              {period.mode === 'quarter' && (
                <span className="text-[10px] text-brand-mid">
                  {quarterMonthsLabel(period)}
                </span>
              )}
            </div>

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

          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border">
            {(Object.keys(PERIOD_MODE_LABELS) as PeriodMode[]).map(mode => {
              const active = period.mode === mode
              const accessible = plan === 'pro' || mode === 'month'
              return (
                <button
                  key={mode}
                  onClick={accessible ? () => changeMode(mode) : () => { void startProCheckout() }}
                  disabled={!accessible && false}  // dejamos que el click gatille checkout en lugar de bloquear
                  aria-label={accessible ? PERIOD_MODE_LABELS[mode] : `${PERIOD_MODE_LABELS[mode]} (Pro)`}
                  className={[
                    'flex-1 text-[11px] font-semibold rounded-lg min-h-[32px] px-1.5 transition-colors flex items-center justify-center gap-1',
                    active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                    accessible ? 'cursor-pointer' : 'cursor-pointer opacity-60',
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

        {/* ── Banner Free bloqueado ── */}
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

        {/* ── Tab content ── */}
        {tab === 'periodo' && (
          <>
            <EstePeriodoView period={period} />

            {/* Botones de export — siempre que haya movements, igual que antes */}
            {profile && movements.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <PdfDownloadButton
                  periodSlug={slug}
                  periodLabel={label}
                  movements={movements}
                  displayName={profile.displayName}
                  giro={profile.giro}
                  includeInvestments={includeInvestments}
                />
                {isPro ? (
                  <ExcelDownloadButton
                    periodSlug={slug}
                    periodLabel={label}
                    movements={movements}
                    displayName={profile.displayName}
                    giro={profile.giro}
                    includeInvestments={includeInvestments}
                  />
                ) : (
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
            )}

            {/* Toggle inversiones — solo si hay alguna en el período */}
            {movements.some(m => m.isInvestment) && (
              <label className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 cursor-pointer border border-brand-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-brand">
                    Incluir inversiones en el PDF/Excel
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
          </>
        )}

        {tab === 'comparar' && (
          <ComoVoyView period={period} plan={plan} />
        )}
      </main>
    </div>
  )
}

// Sub-label para mostrar "Abr–Jun" debajo del "Trimestre 2 · 2026"
function quarterMonthsLabel(p: PeriodSelection): string {
  const a = new Date(p.anchor + 'T12:00:00')
  const qStart = Math.floor(a.getMonth() / 3) * 3
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[qStart]} – ${months[qStart + 2]}`
}
