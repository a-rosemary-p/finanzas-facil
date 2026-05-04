'use client'

/**
 * ¿Cómo voy? — pestaña de análisis comparativo de /reportes (v0.29).
 *
 * Pro only. Free ve el mismo layout pero con datos placeholder difuminados +
 * CTA centrado "Activar Pro" → directo a Stripe.
 *
 * Bloques (orden vertical, todos siempre visibles para que el layout NO salte
 * cuando llega el análisis):
 *   1. Pies de Ingresos / Gastos por categoría — siempre cargados con la data
 *      del período. Sin AI.
 *   2. Card de IA con tamaño fijo. Inicia vacío con un botón "Analizar con IA".
 *      Click → llamada a /api/reports/insights, rellena el card sin empujar
 *      lo de abajo. Cambiar el período NO regenera automáticamente — vuelve
 *      al estado vacío y el user vuelve a clickear si lo quiere.
 *   3. Tendencia: gráfica con últimos 12 meses. Absorbe la antigua tab.
 *
 * Datos AI: /api/reports/insights (gpt-4.1-mini).
 * Datos pies / period: /api/reports/period-summary (extendido en v0.29 con byCategory).
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import type { PeriodSelection } from '@/lib/periods'

const TrendChart = dynamic(
  () => import('./trend-chart-mini').then(m => m.TrendChartMini),
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

const CategoryPies = dynamic(
  () => import('./category-pies').then(m => m.CategoryPies),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-2xl border border-brand-border p-4">
        <p className="text-sm text-brand-mid text-center">Cargando categorías...</p>
      </div>
    ),
  },
)

interface InsightsResponse {
  headline: string
  insights: string[]
  cheer: string
}

interface ByCategory {
  [cat: string]: { income: number; expenses: number }
}

interface PeriodSummary {
  byCategory: ByCategory
  current: { income: number; expenses: number; net: number }
}

interface Props {
  period: PeriodSelection
  plan: 'free' | 'pro'
}

export function ComoVoyView({ period, plan }: Props) {
  if (plan === 'free') {
    return <FreePreview />
  }
  return <ProView period={period} />
}

// ── Pro view ────────────────────────────────────────────────────────────────

function ProView({ period }: { period: PeriodSelection }) {
  // Datos del período (pies). Siempre cargado, no requiere AI.
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setSummaryLoading(true)
    fetchWithAuthRetry(`/api/reports/period-summary?mode=${period.mode}&anchor=${period.anchor}`)
      .then(r => r.json())
      .then((d: PeriodSummary) => {
        if (!cancelled) {
          setSummary(d)
          setSummaryLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null)
          setSummaryLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [period.mode, period.anchor])

  // Estado del análisis IA — manual, no se autodispara con cambios de período.
  type InsightsState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; data: InsightsResponse }
    | { kind: 'error'; msg: string }
  const [insightsState, setInsightsState] = useState<InsightsState>({ kind: 'idle' })

  // Reset a 'idle' cuando cambia el período — el user pide explicitly que NO
  // se autogenere; queremos que vuelva al CTA.
  useEffect(() => {
    setInsightsState({ kind: 'idle' })
  }, [period.mode, period.anchor])

  async function runAnalysis() {
    setInsightsState({ kind: 'loading' })
    try {
      const res = await fetchWithAuthRetry(`/api/reports/insights?mode=${period.mode}&anchor=${period.anchor}`)
      const json = await res.json().catch(() => null) as Record<string, unknown> | null
      if (!res.ok) {
        setInsightsState({ kind: 'error', msg: (json?.['error'] as string) || 'No se pudo generar el análisis.' })
        return
      }
      setInsightsState({ kind: 'ready', data: json as unknown as InsightsResponse })
    } catch {
      setInsightsState({ kind: 'error', msg: 'Sin conexión. Intenta de nuevo.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bloque 1: Pies por categoría */}
      <CategoryPies
        byCategory={summary?.byCategory ?? {}}
        loading={summaryLoading}
      />

      {/* Bloque 2: Card de IA con tamaño fijo. */}
      <AICard state={insightsState} onAnalyze={runAnalysis} />

      {/* Bloque 3: Tendencia */}
      <div className="flex flex-col gap-2">
        <p className="fz-eyebrow px-1">Tendencia · últimos 12 meses</p>
        <TrendChart granularity="month" />
      </div>
    </div>
  )
}

// ── AI Card (tamaño fijo) ──────────────────────────────────────────────────

interface AICardProps {
  state:
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; data: InsightsResponse }
    | { kind: 'error'; msg: string }
  onAnalyze: () => void
}

function AICard({ state, onAnalyze }: AICardProps) {
  // min-height fijo para que el card NO crezca/encoja según el contenido —
  // el layout se queda estable cuando llega el análisis.
  return (
    <div className="bg-white rounded-2xl border border-brand-light shadow-fz-1 fz-ai-card flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-brand-border">
        <div className="flex items-center gap-1.5">
          <AIBadge animated={state.kind === 'loading'} />
          <span className="fz-eyebrow">Análisis IA</span>
        </div>
        {state.kind === 'ready' && (
          <button
            type="button"
            onClick={onAnalyze}
            className="text-[11px] font-medium text-brand-mid underline"
          >
            Regenerar
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col">
        {state.kind === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-chip text-brand">
              <AIIcon size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">
                ¿Qué cuentan tus números?
              </p>
              <p className="text-xs mt-1 text-brand-mid max-w-[280px]">
                La IA analiza este período vs el anterior y te dice qué está cambiando, en lenguaje claro y adaptado a tu giro.
              </p>
            </div>
            <button
              type="button"
              onClick={onAnalyze}
              className="text-sm font-bold py-2.5 px-5 rounded-xl text-white bg-brand mt-1 inline-flex items-center gap-1.5"
            >
              <AIIcon size={14} />
              Analizar con IA
            </button>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" className="text-brand fz-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p className="text-sm text-brand-mid">Analizando tus números…</p>
            <p className="text-xs text-ink-300">Tarda unos segundos</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-danger">{state.msg}</p>
            <button
              type="button"
              onClick={onAnalyze}
              className="text-xs font-medium px-3 py-2 rounded-lg text-brand border border-brand-border bg-brand-chip"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-base font-bold text-ink-900 leading-snug">
              {state.data.headline}
            </p>
            <ul className="flex flex-col gap-2">
              {state.data.insights.map((text, i) => (
                <li key={i} className="text-sm text-ink-700 leading-relaxed flex gap-2">
                  <span className="text-brand-mid mt-0.5 shrink-0">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            {state.data.cheer && (
              <p className="text-sm font-medium italic text-income-text mt-auto pt-2">
                {state.data.cheer}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Free preview ───────────────────────────────────────────────────────────

function FreePreview() {
  const mockByCategory: ByCategory = {
    'Servicios profesionales': { income: 12450, expenses: 0 },
    'Honorarios': { income: 4800, expenses: 0 },
    'Reembolsos': { income: 1200, expenses: 0 },
    'Marketing y publicidad': { income: 0, expenses: 3200 },
    'Software y suscripciones': { income: 0, expenses: 1850 },
    'Renta': { income: 0, expenses: 2500 },
    'Servicios básicos': { income: 0, expenses: 800 },
  }

  const mockInsights: InsightsResponse = {
    headline: 'Vendiste 23% más que el mes pasado, principalmente por servicios.',
    insights: [
      'Tu margen neto se mantuvo en 31%, alineado con tu giro.',
      'Los gastos de marketing crecieron 45% pero ingresos solo 23% — vale la pena revisar el ROI.',
      'Tu mejor semana fue la del 15-21 — replica ese ritmo si puedes.',
    ],
    cheer: 'Sigue así. Vas mejor que el mes pasado, y se nota.',
  }

  return (
    <div className="relative">
      <div className="fz-blur-preview">
        <div className="flex flex-col gap-4">
          <CategoryPies byCategory={mockByCategory} loading={false} />
          <AICard state={{ kind: 'ready', data: mockInsights }} onAnalyze={() => {}} />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-xs text-center flex flex-col gap-3 items-center border border-brand-light fz-shadow-cta">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-chip text-brand">
            <AIIcon size={22} />
          </div>
          <p className="font-bold text-base text-brand">Análisis profundo de tu negocio</p>
          <p className="text-xs leading-relaxed text-brand-mid">
            Pies de categorías, comparativas inteligentes adaptadas a tu giro, y tendencia histórica. Todo en una vista.
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

// ── Sub-components ──────────────────────────────────────────────────────────

function AIBadge({ animated = false }: { animated?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand-chip text-brand border border-brand-light',
        animated ? 'fz-pulse' : '',
      ].filter(Boolean).join(' ')}
    >
      <AIIcon size={10} />
      IA
    </span>
  )
}

function AIIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.6 4.4 4.4 1.6-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 13l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7L19 13z" />
      <path d="M5 16l.5 1.4 1.4.5-1.4.5L5 19.8l-.5-1.4L3.1 17.9l1.4-.5L5 16z" />
    </svg>
  )
}
