'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useEntries } from '@/hooks/use-entries'
import { MovementCard } from '@/components/entries/entry-card'
import { EntryForm } from '@/components/entries/entry-form'
import { ConfirmationScreen } from '@/components/entries/confirmation-screen'
import { formatCurrency } from '@/lib/utils'
import { DATE_FILTER_LABELS } from '@/lib/constants'
import type { DateFilter, Entry, Movement, PendingMovement } from '@/types'

const FILTERS: DateFilter[] = ['today', '7days', 'month', 'year']

type Mode = 'dashboard' | 'confirming'

interface PendingData {
  rawText: string
  entryDate: string
  movements: PendingMovement[]
}

// Aplana entries → movements ordenados por movementDate DESC,
// con createdAt de la entry como tiebreaker (orden consistente entre refresh y post-confirm)
function flatMovements(entries: Entry[]): Movement[] {
  return entries
    .flatMap(e => e.movements.map(m => ({ ...m, _entryCreatedAt: e.createdAt })))
    .sort((a, b) => {
      if (b.movementDate !== a.movementDate) {
        return b.movementDate.localeCompare(a.movementDate)
      }
      return b._entryCreatedAt.localeCompare(a._entryCreatedAt)
    })
}

function getFechaFormateada(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function DashboardInner() {
  const { profile, loading: authLoading, logout } = useAuth()
  const {
    entries,
    metrics,
    filter,
    setFilter,
    loadData,
    loadMore,
    loading,
    loadingMore,
    hasMore,
    prependEntry,
  } = useEntries()

  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('dashboard')
  const [pendingData, setPendingData] = useState<PendingData | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradedBanner, setUpgradedBanner] = useState(false)

  useEffect(() => {
    if (profile) loadData('today')
  }, [profile, loadData])

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true)
      // Clean the URL without reload
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const handleUpgrade = useCallback(async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setCheckoutLoading(false)
    }
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // silently ignore
    } finally {
      setPortalLoading(false)
    }
  }, [])

  function handleMovementsExtracted(data: PendingData) {
    setPendingData(data)
    setMode('confirming')
    // Scroll al tope para mostrar la pantalla de confirmación
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleConfirmed(entry: Entry) {
    prependEntry(entry)
    setMode('dashboard')
    setPendingData(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancel() {
    setMode('dashboard')
    setPendingData(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: '#5A7A8A' }}>Cargando...</p>
      </div>
    )
  }

  const neto = metrics.net

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #EEF4EE 0%, #E4F0E4 100%)' }}>
      {/* Header */}
      <header
        className="bg-white sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          borderBottom: '1px solid #E0E0E0',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px',
          minHeight: '56px',
        }}
      >
        <span className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
          💰 FinanzasFácil
        </span>

        <div className="flex items-center gap-3">
          <span
            className="text-sm font-medium px-3 py-2 rounded-full min-h-[44px] flex items-center"
            style={
              profile?.plan === 'pro'
                ? { background: '#2E7D32', color: '#fff', border: '1px solid #2E7D32' }
                : { background: '#E0E0E0', color: '#5A7A8A', border: '1px solid #E0E0E0' }
            }
          >
            {profile?.plan === 'pro' ? 'Pro' : 'Free'}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg min-h-[44px] transition-colors"
            style={{ color: '#5A7A8A', background: '#F5F5F5', border: '1px solid #E0E0E0' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Salir
          </button>
        </div>
      </header>

      <main
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {mode === 'confirming' && pendingData ? (
          /* ── Pantalla de confirmación ── */
          <ConfirmationScreen
            rawText={pendingData.rawText}
            entryDate={pendingData.entryDate}
            initialMovements={pendingData.movements}
            onConfirmed={handleConfirmed}
            onCancel={handleCancel}
          />
        ) : (
          /* ── Dashboard normal ── */
          <>
            {/* Saludo */}
            <div>
              <p className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
                Hola, {profile?.displayName} 👋
              </p>
              <p className="text-sm italic capitalize" style={{ color: '#5A7A8A' }}>
                {getFechaFormateada()}
              </p>
            </div>

            {/* Formulario de entrada */}
            <EntryForm onMovementsExtracted={handleMovementsExtracted} />

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors border min-h-[44px] flex items-center"
                  style={
                    filter === f
                      ? { background: '#2E7D32', color: '#fff', borderColor: '#2E7D32' }
                      : { background: '#fff', color: '#5A7A8A', borderColor: '#E0E0E0' }
                  }
                >
                  {DATE_FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Ingresos" value={metrics.income} color="#1B5E20" bg="#C8E6C9" border="#A5D6A7" sign="+" />
              <MetricCard label="Gastos" value={metrics.expenses} color="#B71C1C" bg="#FFCDD2" border="#EF9A9A" sign="−" />
              <MetricCard
                label="Neto"
                value={neto}
                color={neto >= 0 ? '#1B5E20' : '#B71C1C'}
                bg={neto >= 0 ? '#C8E6C9' : '#FFCDD2'}
                border={neto >= 0 ? '#A5D6A7' : '#EF9A9A'}
                sign={neto >= 0 ? '+' : '−'}
              />
            </div>

            {/* Historial */}
            <section className="flex flex-col gap-3">
              <h2 className="font-bold" style={{ color: '#1A2B3A' }}>
                {filter === 'today'
                  ? 'Registros de hoy'
                  : `Registros — ${DATE_FILTER_LABELS[filter]}`}
              </h2>

              {loading ? (
                <p className="text-sm text-center py-8" style={{ color: '#5A7A8A' }}>
                  Cargando...
                </p>
              ) : entries.length === 0 ? (
                <div
                  className="bg-white rounded-xl shadow-sm p-6 text-center"
                  style={{ border: '1px solid #E0E0E0' }}
                >
                  <p className="text-sm" style={{ color: '#5A7A8A' }}>
                    Sin registros para este período.
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#5A7A8A' }}>
                    Escribe arriba lo que pasó en tu negocio hoy.
                  </p>
                </div>
              ) : (
                <>
                  {flatMovements(entries).map(m => (
                    <MovementCard key={m.id} movement={m} />
                  ))}
                  {hasMore && (
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full py-3 rounded-xl text-sm font-medium transition-colors border min-h-[44px]"
                      style={{ borderColor: '#2E7D32', color: '#2E7D32', background: '#fff' }}
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más'}
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Banner upgrade exitoso */}
            {upgradedBanner && (
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: '#F0FAF4', border: '1px solid #2E7D32' }}
              >
                <span className="text-xl">🎉</span>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: '#2E7D32' }}>
                    ¡Bienvenido al plan Pro!
                  </p>
                  <p className="text-xs" style={{ color: '#5A7A8A' }}>
                    Ya tienes movimientos ilimitados.
                  </p>
                </div>
                <button
                  onClick={() => setUpgradedBanner(false)}
                  className="text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center"
                  style={{ color: '#5A7A8A' }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Banner plan Free */}
            {profile?.plan === 'free' && (
              <div
                className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2"
                style={{ border: '1px solid #E0E0E0' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
                    Plan Free
                  </p>
                  <p className="text-sm" style={{ color: '#5A7A8A' }}>
                    {profile.movementsToday}/10 hoy
                  </p>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: '#E0E0E0' }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min((profile.movementsToday / 10) * 100, 100)}%`,
                      background: profile.movementsToday >= 10 ? '#C62828' : '#2E7D32',
                    }}
                  />
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[44px] transition-opacity disabled:opacity-60"
                  style={{ background: '#2E7D32' }}
                >
                  {checkoutLoading ? 'Redirigiendo...' : 'Actualizar a Pro — $99/mes'}
                </button>
              </div>
            )}

            {/* Panel plan Pro */}
            {profile?.plan === 'pro' && (
              <div
                className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between"
                style={{ border: '1px solid #E0E0E0' }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: '#2E7D32' }}>
                    Plan Pro activo ✓
                  </p>
                  <p className="text-xs" style={{ color: '#5A7A8A' }}>
                    Movimientos ilimitados
                  </p>
                </div>
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="text-xs font-medium px-3 py-2 rounded-lg border min-h-[36px] transition-opacity disabled:opacity-60"
                  style={{ borderColor: '#E0E0E0', color: '#5A7A8A', background: '#F5F5F5' }}
                >
                  {portalLoading ? '...' : 'Gestionar'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: '#5A7A8A' }}>Cargando...</p>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  )
}

function MetricCard({
  label, value, color, bg, border, sign,
}: {
  label: string; value: number; color: string; bg: string; border: string; sign: string
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 min-w-0" style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color }}>
        {label}
      </span>
      <span className="text-base font-bold truncate leading-tight" style={{ color }}>
        {sign}{formatCurrency(value)}
      </span>
    </div>
  )
}
