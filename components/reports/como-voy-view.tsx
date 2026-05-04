'use client'

/**
 * ¿Cómo voy? — pestaña de análisis comparativo de /reportes (v0.29).
 *
 * Pro only. Free ve el mismo layout pero con datos placeholder difuminados +
 * CTA centrado "Activar Pro" → directo a Stripe.
 *
 * Bloques:
 *  1. Headline AI: lectura principal en una frase con número concreto
 *  2. Insights AI: 3-4 frases con observaciones y recomendaciones por giro
 *  3. Tendencia: gráfica con últimos 12 períodos del mismo modo (absorbe Tendencia)
 *  4. Cheer: frase de cierre AI
 *
 * Datos AI vienen de /api/reports/insights (gpt-4.1-mini, cache 1h browser-side).
 * Tendencia viene de /api/reports/trend (existente).
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import type { PeriodSelection, PeriodMode } from '@/lib/periods'

// recharts es ~100KB — solo cargar cuando esta tab se monta
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

interface InsightsResponse {
  headline: string
  insights: string[]
  cheer: string
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
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setInsights(null)

    fetchWithAuthRetry(`/api/reports/insights?mode=${period.mode}&anchor=${period.anchor}`)
      .then(async r => {
        const json = await r.json().catch(() => null) as Record<string, unknown> | null
        if (!r.ok) {
          if (cancelled) return
          setError((json?.['error'] as string) || 'No se pudo generar el análisis.')
          setLoading(false)
          return
        }
        if (cancelled) return
        setInsights(json as unknown as InsightsResponse)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Sin conexión. Intenta de nuevo.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [period.mode, period.anchor])

  return (
    <div className="flex flex-col gap-4">
      {/* Bloque 1: Headline */}
      <InsightCard variant="headline" loading={loading} error={error}>
        {insights?.headline}
      </InsightCard>

      {/* Bloque 2: Insights detallados */}
      {insights && insights.insights.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-1">
            <AIBadge />
            <p className="fz-eyebrow">Análisis</p>
          </div>
          {insights.insights.map((text, i) => (
            <InsightCard key={i} variant="insight">{text}</InsightCard>
          ))}
        </div>
      )}

      {/* Bloque 3: Tendencia */}
      <div className="flex flex-col gap-2">
        <p className="fz-eyebrow px-1">Tendencia</p>
        <TrendChart granularity={trendGranularity(period.mode)} />
      </div>

      {/* Bloque 4: Cheer */}
      {insights?.cheer && (
        <InsightCard variant="cheer">{insights.cheer}</InsightCard>
      )}
    </div>
  )
}

function trendGranularity(mode: PeriodMode): 'week' | 'month' {
  // Para week/month → tendencia mensual de 12 meses (más útil que 12 semanas)
  // Para quarter/year → mensual también (12 últimos)
  return 'month'
}

// ── Free preview ────────────────────────────────────────────────────────────

function FreePreview() {
  // Mockup placeholder — no usa data real del user (decisión de producto:
  // mockup más controlado, sin leak)
  const mock: InsightsResponse = {
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
          <InsightCard variant="headline">{mock.headline}</InsightCard>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-1">
              <AIBadge />
              <p className="fz-eyebrow">Análisis</p>
            </div>
            {mock.insights.map((text, i) => (
              <InsightCard key={i} variant="insight">{text}</InsightCard>
            ))}
          </div>
          <InsightCard variant="cheer">{mock.cheer}</InsightCard>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-xs text-center flex flex-col gap-3 items-center border border-brand-light fz-shadow-cta">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-chip text-brand">
            <AIIcon size={22} />
          </div>
          <p className="font-bold text-base text-brand">Análisis profundo de tu negocio</p>
          <p className="text-xs leading-relaxed text-brand-mid">
            Comparativas inteligentes adaptadas a tu giro, generadas con IA. Detecta qué está cambiando y por qué.
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

interface InsightCardProps {
  variant: 'headline' | 'insight' | 'cheer'
  loading?: boolean
  error?: string
  children?: React.ReactNode
}

function InsightCard({ variant, loading, error, children }: InsightCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-brand-border p-4 flex items-center gap-2">
        <AIBadge animated />
        <p className="text-sm text-brand-mid">Analizando tus números...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-danger-bg rounded-xl border border-danger-border p-4">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  if (variant === 'headline') {
    return (
      <div className="bg-white rounded-2xl border border-brand-light p-4 shadow-fz-1">
        <div className="flex items-center gap-1.5 mb-2">
          <AIBadge />
          <span className="fz-eyebrow">Lectura</span>
        </div>
        <p className="text-base font-bold text-ink-900 leading-snug">
          {children}
        </p>
      </div>
    )
  }
  if (variant === 'cheer') {
    return (
      <div className="bg-income-bg rounded-xl border border-income-border p-3 text-center">
        <p className="text-sm font-medium italic text-income-text">
          {children}
        </p>
      </div>
    )
  }
  // insight
  return (
    <div className="bg-white rounded-xl border border-brand-border p-3">
      <p className="text-sm text-ink-700 leading-relaxed">
        {children}
      </p>
    </div>
  )
}

// AI badge — pequeño chip indicando que el contenido viene de un modelo
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

// Sparkly icon — decorativo, asocia "esto lo dijo el modelo"
function AIIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.6 4.4 4.4 1.6-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 13l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7L19 13z" />
      <path d="M5 16l.5 1.4 1.4.5-1.4.5L5 19.8l-.5-1.4L3.1 17.9l1.4-.5L5 16z" />
    </svg>
  )
}
