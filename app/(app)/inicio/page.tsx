'use client'

/**
 * Página principal de Fiza — `/inicio` (rediseño abr 2026, antes /dashboard).
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
import { WaveSection } from '@/components/ui/wave'
import { FeedbackModal } from '@/components/feedback-modal'
import { MetricsCard } from '@/components/inicio/metrics-card'
import { InputCard } from '@/components/inicio/input-card'
import { RecentMovements } from '@/components/inicio/recent-movements'
import { Onboarding, type OnboardingHighlight } from '@/components/onboarding/onboarding'
import { ProfilePromptModal } from '@/components/onboarding/profile-prompt-modal'
import type { RegistrosPeriod } from '@/components/inicio/period-dropdown'
import type { Entry, PendingMovement } from '@/types'

type Mode = 'dashboard' | 'confirming'

interface PendingData {
  rawText: string
  entryDate: string
  movements: PendingMovement[]
  /** Cómo se capturó la entry — usado por confirm para persistir input_source. */
  inputSource: 'text' | 'voice' | 'photo'
}

function getFechaFormateada(): string {
  const raw = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toLowerCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Inner ───────────────────────────────────────────────────────────────────

function RegistrosInner() {
  const { profile, loading: authLoading, refreshProfile, updateProfile } = useAuth()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>('dashboard')
  const [pendingData, setPendingData] = useState<PendingData | null>(null)
  const [period, setPeriod] = useState<RegistrosPeriod>('global')
  const [refreshKey, setRefreshKey] = useState(0)

  // (v0.292) Insight chip removido — el copy era confuso ("te dice algo en
  // general"). El endpoint `/api/insights` sigue vivo y el state se puede
  // restaurar acá cuando rediseñemos qué decirle al user en ese spot.
  const [upgradedBanner, setUpgradedBanner] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Onboarding inline: trigger en `total_movements === 0 && !onboardedAt`.
  // Se cierra explícitamente cuando el user termina o salta — `onboardedAt`
  // queda seteado en DB para no volver a aparecer.
  const [onboardingHighlight, setOnboardingHighlight] = useState<OnboardingHighlight>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const showOnboarding =
    !!profile &&
    profile.totalMovements === 0 &&
    !profile.onboardedAt &&
    !onboardingDismissed &&
    mode === 'dashboard' // No lo mostramos sobre el ConfirmationScreen real

  // Profile prompt (v0.292): después del primer movimiento confirmado, modal
  // pidiendo ciudad/estado/giro como datos opcionales. Se dispara una vez —
  // `profile_prompt_seen_at` queda seteado al cerrar (haya llenado o no).
  const [profilePromptDismissed, setProfilePromptDismissed] = useState(false)
  const showProfilePrompt =
    !!profile &&
    profile.totalMovements >= 1 &&
    !profile.profilePromptSeenAt &&
    !profilePromptDismissed &&
    !showOnboarding &&
    mode === 'dashboard'

// Banner de bienvenida tras checkout exitoso.
  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true)
      window.history.replaceState({}, '', '/inicio')
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
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      {mode === 'confirming' && pendingData ? (
        <main className="max-w-lg mx-auto px-4 py-6 fz-pad-safe-bottom">
          <ConfirmationScreen
            rawText={pendingData.rawText}
            entryDate={pendingData.entryDate}
            initialMovements={pendingData.movements}
            inputSource={pendingData.inputSource}
            onConfirmed={handleConfirmed}
            onCancel={handleCancel}
          />
        </main>
      ) : (
        <main className="max-w-lg mx-auto fz-pad-safe-bottom">
          {/* Greeting */}
          <div className="px-[18px] pt-[22px] pb-4">
            <h1 className="font-bold text-[22px] leading-[1.1] tracking-[-0.02em] text-ink-900 m-0">
              Hola, {profile?.displayName ?? ''}
            </h1>
            <div className="text-xs mt-0.5 text-ink-500">
              {getFechaFormateada()}
            </div>
          </div>

          {/* Wave divisor */}
          <div className="px-4 pb-2">
            <WaveSection />
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
            <InputCard
              onMovementsExtracted={handleMovementsExtracted}
              onboardingHighlight={onboardingHighlight}
            />
          </div>

{/* Wave divisor */}
          <div className="px-4 pt-3.5 pb-1.5">
            <WaveSection />
          </div>

          {/* Recent movements */}
          <div className="px-3.5 pb-4">
            <RecentMovements refreshKey={refreshKey} />
          </div>

          {/* Banner upgrade exitoso */}
          {upgradedBanner && (
            <div className="mx-3.5 mt-2 rounded-xl p-4 flex items-center gap-3 bg-brand-chip border border-brand-light">
              <div className="flex-1">
                <p className="text-sm font-bold text-brand">¡Bienvenido al plan Pro!</p>
                <p className="text-xs text-brand-mid">Ya tienes movimientos ilimitados.</p>
              </div>
              <button
                type="button"
                onClick={() => setUpgradedBanner(false)}
                className="text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center text-brand-mid"
                aria-label="Cerrar"
              >×</button>
            </div>
          )}

          {/* Banner Base (= plan='free' en DB) */}
          {profile?.plan === 'free' && (
            <div className="mx-3.5 mt-2 bg-white rounded-xl p-4 flex flex-col gap-2 border border-brand-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-brand">Plan Base</p>
                <p className="text-sm text-brand-mid">{profile.movementsToday}/10 hoy</p>
              </div>
              <div className="w-full rounded-full h-1.5 bg-brand-border">
                <div
                  className={[
                    'h-1.5 rounded-full transition-all',
                    profile.movementsToday >= 10 ? 'bg-danger' : 'bg-brand',
                  ].join(' ')}
                  style={{
                    // El % es dinámico, no hay forma de hacerlo via class
                    // sin generar un set infinito de utilities arbitrarias.
                    width: `${Math.min((profile.movementsToday / 10) * 100, 100)}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[44px] transition-opacity disabled:opacity-60 bg-brand"
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
            <div className="mx-3.5 mt-2 bg-white rounded-xl p-4 flex items-center justify-between border border-brand-border">
              <div>
                <p className="text-sm font-bold text-brand">Plan Pro activo ✓</p>
                <p className="text-xs text-brand-mid">Movimientos ilimitados</p>
              </div>
              <button
                type="button"
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-brand-border text-brand-mid bg-brand-chip min-h-[36px] transition-opacity disabled:opacity-60"
              >
                {portalLoading ? '...' : 'Gestionar'}
              </button>
            </div>
          )}

          {/* Comentarios — abre modal de feedback. NO mailto: el destino
           * (admin@fiza.mx) no se expone al user; viaja por POST /api/feedback
           * que internamente lo manda con Resend. */}
          <div className="flex justify-center pt-3 px-4">
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-brand-mid"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Comentarios
            </button>
          </div>
        </main>
      )}

      {/* Modal de feedback — global a la página (no se cierra al cambiar
       * mode='confirming'). */}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Onboarding inline (primera vez del user). Renderizado después del
       * <main> para que sus elementos fixed/zIndex queden encima sin conflictos
       * de stacking context. Cuando el user salta/termina, marca onboarded_at
       * via /api/onboarding/complete y refrescamos el profile. */}
      {showOnboarding && (
        <Onboarding
          displayName={profile?.displayName ?? ''}
          onHighlightChange={setOnboardingHighlight}
          onSaveName={async name => {
            await updateProfile({ displayName: name })
          }}
          onComplete={() => {
            setOnboardingDismissed(true)
            setOnboardingHighlight(null)
            // Sin await — visual cierra inmediato. El profile se refresca
            // en el próximo mount; en este sesión, onboardingDismissed local
            // mantiene la página normal.
            void refreshProfile()
          }}
        />
      )}

      {/* Profile prompt — modal post-primer-movimiento. Se cierra al
       * submit/dismiss y marca seen_at en DB para no volver. */}
      {showProfilePrompt && (
        <ProfilePromptModal
          onComplete={() => {
            setProfilePromptDismissed(true)
            void refreshProfile()
          }}
        />
      )}
    </div>
  )
}

export default function RegistrosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    }>
      <RegistrosInner />
    </Suspense>
  )
}
