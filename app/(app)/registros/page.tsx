'use client'

/**
 * Página principal de Fiza — `/registros` (rediseño abr 2026, antes /dashboard).
 *
 * Único propósito: que el user **registre** lo que pasó en su negocio. Los
 * elementos de exploración (filtros de tipo, búsqueda por mes específico,
 * pendientes mezclados, agrupación por fecha) se movieron a `/reportes`.
 *
 * Layout (de arriba a abajo):
 *   AppHeader (sticky, blanco, wave cutoff)
 *   Greeting "Hola, {displayName}" + fecha
 *   Wave divisor (alta frecuencia, brand-mid 50%)
 *   MetricsCard — período (Hoy/Semana/Mes/Año) + 3 sub-cards con sparkline+delta
 *   InputCard — 3 botones (Foto/Dictar/Escribir), textarea expandible cuando Escribir
 *   Insight chip (centrado)
 *   Wave divisor
 *   RecentMovements — últimos 5 por created_at, "Mostrar más" → 10 → /reportes
 *   Upgrade banner (welcome) si ?upgraded=1
 *   Plan banner (Free progress / Pro gestionar)
 *   Link de contacto
 *
 * Estado:
 *   - mode: 'dashboard' | 'confirming' — al extraer movs, mostramos
 *     ConfirmationScreen en lugar del layout normal.
 *   - period: cuál período muestra MetricsCard. Local — no afecta a
 *     RecentMovements (ahí solo se muestran los más recientes globalmente).
 *   - refreshKey: bump tras confirmar un registro para que MetricsCard y
 *     RecentMovements vuelvan a fetchar. Reemplaza el flujo viejo de
 *     useEntries.prependEntry — ahora cada componente es responsable de su
 *     propia data.
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { ConfirmationScreen } from '@/components/entries/confirmation-screen'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { AppHeader } from '@/components/app-header'
import { MetricsCard } from '@/components/registros/metrics-card'
import { InputCard } from '@/components/registros/input-card'
import { RecentMovements } from '@/components/registros/recent-movements'
import type { RegistrosPeriod } from '@/components/registros/period-dropdown'
import type { Entry, PendingMovement } from '@/types'

type Mode = 'dashboard' | 'confirming'

interface PendingData {
  rawText: string
  entryDate: string
  movements: PendingMovement[]
}

function getFechaFormateada(): string {
  const raw = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toLowerCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Inner ───────────────────────────────────────────────────────────────────

function RegistrosInner() {
  const { profile, loading: authLoading, refreshProfile } = useAuth()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>('dashboard')
  const [pendingData, setPendingData] = useState<PendingData | null>(null)
  const [period, setPeriod] = useState<RegistrosPeriod>('month')
  const [refreshKey, setRefreshKey] = useState(0)

  const [insight, setInsight] = useState<string | null>(null)
  const [upgradedBanner, setUpgradedBanner] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // Insight: fire-and-forget; no se loguea error si falla.
  useEffect(() => {
    if (!profile?.id) return
    fetchWithAuthRetry('/api/insights')
      .then(r => r.json())
      .then((d: { insight?: string }) => { if (d.insight) setInsight(d.insight) })
      .catch(() => { /* non-critical */ })
  }, [profile?.id])

  // Banner de bienvenida tras checkout exitoso.
  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true)
      window.history.replaceState({}, '', '/registros')
    }
  }, [searchParams])

  const handleUpgrade = useCallback(async () => {
    setCheckoutLoading(true)
    await startProCheckout()
    setCheckoutLoading(false)
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetchWithAuthRetry('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else if (data.error) window.alert(data.error)
    } catch { window.alert('No se pudo conectar. Intenta de nuevo.') }
    finally { setPortalLoading(false) }
  }, [])

  function handleMovementsExtracted(data: PendingData) {
    setPendingData(data)
    setMode('confirming')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function handleConfirmed(_entry: Entry) {
    setMode('dashboard')
    setPendingData(null)
    setRefreshKey(k => k + 1)  // ← MetricsCard + RecentMovements re-fetch
    refreshProfile()             // ← actualiza movements_today
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function handleCancel() { setMode('dashboard'); setPendingData(null) }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      <AppHeader />

      {mode === 'confirming' && pendingData ? (
        <main className="max-w-lg mx-auto px-4 py-6"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <ConfirmationScreen
            rawText={pendingData.rawText}
            entryDate={pendingData.entryDate}
            initialMovements={pendingData.movements}
            onConfirmed={handleConfirmed}
            onCancel={handleCancel}
          />
        </main>
      ) : (
        <main className="max-w-lg mx-auto" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {/* Greeting */}
          <div style={{ padding: '22px 18px 16px' }}>
            <h1
              className="font-bold"
              style={{
                fontSize: 22,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--ink-900)',
                margin: 0,
              }}
            >
              Hola, {profile?.displayName ?? ''}
            </h1>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
              {getFechaFormateada()}
            </div>
          </div>

          {/* Wave divisor */}
          <div style={{ padding: '0 16px 8px' }}>
            <WaveDivisor />
          </div>

          {/* MetricsCard */}
          <div className="px-3.5 mb-2.5">
            <MetricsCard
              period={period}
              onPeriodChange={setPeriod}
              refreshKey={refreshKey}
            />
          </div>

          {/* InputCard */}
          <div className="px-3.5 mb-2.5">
            <InputCard onMovementsExtracted={handleMovementsExtracted} />
          </div>

          {/* Insight chip */}
          {insight && (
            <div className="flex justify-center" style={{ padding: '14px 18px 4px' }}>
              <span
                className="inline-block rounded-full text-xs px-3 py-1.5"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--expense-border)',
                  color: 'var(--ink-700)',
                  maxWidth: 320,
                  textAlign: 'center',
                }}
              >
                {insight}
              </span>
            </div>
          )}

          {/* Wave divisor */}
          <div style={{ padding: '14px 16px 6px' }}>
            <WaveDivisor />
          </div>

          {/* Recent movements */}
          <div className="px-3.5 pb-4">
            <RecentMovements refreshKey={refreshKey} />
          </div>

          {/* Banner upgrade exitoso */}
          {upgradedBanner && (
            <div className="mx-3.5 mt-2 rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-light)' }}
            >
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>¡Bienvenido al plan Pro!</p>
                <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>Ya tienes movimientos ilimitados.</p>
              </div>
              <button
                type="button"
                onClick={() => setUpgradedBanner(false)}
                className="text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center"
                style={{ color: 'var(--brand-mid)' }}
                aria-label="Cerrar"
              >×</button>
            </div>
          )}

          {/* Banner Base (= plan='free' en DB) */}
          {profile?.plan === 'free' && (
            <div className="mx-3.5 mt-2 bg-white rounded-xl p-4 flex flex-col gap-2"
              style={{ border: '1px solid var(--brand-border)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Plan Base</p>
                <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>{profile.movementsToday}/10 hoy</p>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: 'var(--brand-border)' }}>
                <div className="h-1.5 rounded-full transition-all" style={{
                  width: `${Math.min((profile.movementsToday / 10) * 100, 100)}%`,
                  background: profile.movementsToday >= 10 ? 'var(--danger)' : 'var(--brand)',
                }} />
              </div>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[44px] transition-opacity disabled:opacity-60"
                style={{ background: 'var(--brand)' }}
              >
                {checkoutLoading
                  ? 'Redirigiendo...'
                  : profile.trialUsed
                    ? 'Activa Pro por $49/mes'
                    : 'Prueba Pro gratis 30 días'}
              </button>
            </div>
          )}

          {/* Banner Pro */}
          {profile?.plan === 'pro' && (
            <div className="mx-3.5 mt-2 bg-white rounded-xl p-4 flex items-center justify-between"
              style={{ border: '1px solid var(--brand-border)' }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>Plan Pro activo ✓</p>
                <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>Movimientos ilimitados</p>
              </div>
              <button
                type="button"
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-xs font-medium px-3 py-2 rounded-lg border min-h-[36px] transition-opacity disabled:opacity-60"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
              >
                {portalLoading ? '...' : 'Gestionar'}
              </button>
            </div>
          )}

          {/* Contacto discreto */}
          <div className="flex justify-center pt-3 px-4">
            <a
              href="mailto:admin@fiza.mx"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--brand-mid)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Contacto
            </a>
          </div>
        </main>
      )}
    </div>
  )
}

// Wave de alta frecuencia entre secciones — variante específica del rediseño,
// más densa que `WaveRule` que se usa para hairlines en filas.
function WaveDivisor() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 8"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: 8, color: 'var(--brand-mid)', opacity: 0.5 }}
    >
      <path
        d="M 0 4 C 18 0.5, 36 7.5, 54 4 S 90 0.5, 108 4 S 144 7.5, 162 4 S 198 0.5, 216 4 S 252 7.5, 270 4 S 306 0.5, 324 4 S 342 7.5, 360 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function RegistrosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    }>
      <RegistrosInner />
    </Suspense>
  )
}
