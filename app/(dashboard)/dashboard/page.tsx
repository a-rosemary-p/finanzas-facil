'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useEntries } from '@/hooks/use-entries'
import { MovementDayGroup } from '@/components/entries/movement-day-group'
import { EntryForm } from '@/components/entries/entry-form'
import { ConfirmationScreen } from '@/components/entries/confirmation-screen'
import { FilterBox } from '@/components/dashboard/filter-box'
import { MetricCard } from '@/components/dashboard/metric-card'
import { getPeriodLabel, groupMovementsByDate } from '@/lib/utils'
import { TYPE_FILTER_CONFIG } from '@/lib/constants'
import type { DateFilter, TypeFilter, Entry, PendingMovement } from '@/types'

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

// ─── Dashboard ───────────────────────────────────────────────────────────────

function DashboardInner() {
  const { profile, loading: authLoading, logout } = useAuth()
  const {
    movements, metrics, filter, selectedMonth, typeFilter, showInvestments,
    setFilter, setTypeFilter, setSelectedMonth, setShowInvestments,
    loadData, loadMore, loading, loadingMore, hasMore,
    prependEntry, updateMovement, deleteMovement,
  } = useEntries()

  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('dashboard')
  const [pendingData, setPendingData] = useState<PendingData | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradedBanner, setUpgradedBanner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => { if (profile) loadData('month') }, [profile, loadData])

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const handleUpgrade = useCallback(async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ } finally { setCheckoutLoading(false) }
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ } finally { setPortalLoading(false) }
  }, [])

  function handleMovementsExtracted(data: PendingData) {
    setPendingData(data); setMode('confirming')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function handleConfirmed(entry: Entry) {
    prependEntry(entry); setMode('dashboard'); setPendingData(null)
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

  const neto = metrics.net
  const periodLabel = getPeriodLabel(filter, selectedMonth)
  const grouped = groupMovementsByDate(movements)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          borderBottom: '1px solid var(--brand-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px', minHeight: '56px',
        }}
      >
        <span className="font-bold text-2xl" style={{ color: 'var(--brand)' }}>FinanzasFácil</span>
        <div className="flex items-center gap-3">
          {/* Plan badge */}
          <span className="text-sm font-medium px-3 py-2 rounded-full min-h-[44px] flex items-center"
            style={profile?.plan === 'pro'
              ? { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)' }
              : { background: 'var(--brand-lime)', color: 'var(--brand)', border: '1px solid var(--brand-light)' }
            }
          >
            {profile?.plan === 'pro' ? 'Pro' : 'Free'}
          </span>

          {/* Menú hamburger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="flex flex-col items-center justify-center gap-[5px] rounded-lg min-h-[44px] min-w-[44px] transition-colors"
              style={{ background: menuOpen ? 'var(--brand-chip)' : 'transparent', border: '1px solid var(--brand-border)' }}
              aria-label="Menú"
            >
              <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
              <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
              <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
                style={{ border: '1px solid var(--brand-border)', top: '100%' }}
              >
                {[
                  { icon: '👤', label: 'Perfil', href: '/perfil' },
                  { icon: '⚙️', label: 'Ajustes', href: '/ajustes' },
                  { icon: '📊', label: 'Reportes', href: '/reportes' },
                ].map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--brand-chip)] min-h-[48px]"
                    style={{ color: 'var(--brand)' }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                ))}
                <div style={{ borderTop: '1px solid var(--brand-border)' }}>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); logout() }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full transition-colors hover:bg-[var(--danger-bg)] min-h-[48px]"
                    style={{ color: 'var(--danger)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Salir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {mode === 'confirming' && pendingData ? (
          <ConfirmationScreen rawText={pendingData.rawText} entryDate={pendingData.entryDate}
            initialMovements={pendingData.movements} onConfirmed={handleConfirmed} onCancel={handleCancel}
          />
        ) : (
          <>
            {/* 1. Saludo */}
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--brand)' }}>
                Hola, {profile?.displayName} 👋
              </p>
              <p className="text-sm italic capitalize" style={{ color: 'var(--brand-mid)' }}>
                {getFechaFormateada()}
              </p>
            </div>

            {/* 2. Formulario de entrada */}
            <EntryForm onMovementsExtracted={handleMovementsExtracted} />

            {/* 3. Etiqueta de período + métricas */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>{periodLabel}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showInvestments}
                    onChange={e => setShowInvestments(e.target.checked)}
                    className="w-3.5 h-3.5" style={{ accentColor: 'var(--investment)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>📈 Incluir inversiones</span>
                </label>
              </div>
              <div style={{ height: '1px', background: 'var(--brand-light)' }} />
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Ingresos" value={metrics.income} color="#578466" bg="#DAE68F" border="#92C3A5" sign="+" />
                <MetricCard label="Gastos" value={metrics.expenses} color="#D0481A" bg="#FAD5BF" border="#F79366" sign="−" />
                <MetricCard
                  label="Neto" value={neto}
                  color={neto >= 0 ? '#578466' : '#D0481A'}
                  bg={neto >= 0 ? '#DAE68F' : '#FAD5BF'}
                  border={neto >= 0 ? '#92C3A5' : '#F79366'}
                  sign={neto >= 0 ? '+' : '−'}
                />
              </div>
            </div>

            {/* 4. Filtros */}
            <div className="flex flex-col gap-3">
              <FilterBox filter={filter} selectedMonth={selectedMonth}
                onSetFilter={(f: DateFilter) => setFilter(f)}
                onSetMonth={(d: Date) => setSelectedMonth(d)}
              />
              <div className="flex gap-2">
                {TYPE_FILTER_CONFIG.map(tf => {
                  const active = typeFilter === tf.value
                  return (
                    <button key={tf.value} onClick={() => setTypeFilter(tf.value as TypeFilter)}
                      className="flex-1 py-2 rounded-full text-xs font-bold transition-colors border min-h-[36px]"
                      style={active
                        ? { background: tf.activeBg, color: tf.activeColor, borderColor: tf.activeBorder }
                        : { background: tf.bg, color: tf.color, borderColor: tf.border }
                      }
                    >
                      {tf.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 5. Historial agrupado */}
            <section className="flex flex-col gap-4">
              <h2 className="font-bold" style={{ color: 'var(--brand)' }}>
                Registros
                {typeFilter !== 'all' && (
                  <span className="ml-2 text-sm font-medium" style={{ color: 'var(--brand-mid)' }}>
                    · {TYPE_FILTER_CONFIG.find(t => t.value === typeFilter)?.label}
                  </span>
                )}
              </h2>

              {loading ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
              ) : sortedDates.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center" style={{ border: '1px solid var(--brand-border)' }}>
                  <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Sin registros para este período.</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>Escribe arriba lo que pasó en tu negocio.</p>
                </div>
              ) : (
                <>
                  {sortedDates.map(date => (
                    <MovementDayGroup key={date} date={date} movements={grouped[date]}
                      onUpdated={updateMovement} onDeleted={deleteMovement}
                    />
                  ))}
                  {hasMore && (
                    <button onClick={loadMore} disabled={loadingMore}
                      className="w-full py-3 rounded-xl text-sm font-medium transition-colors border min-h-[44px]"
                      style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: '#fff' }}
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más'}
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Banner upgrade exitoso */}
            {upgradedBanner && (
              <div className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-light)' }}
              >
                <span className="text-xl">🎉</span>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>¡Bienvenido al plan Pro!</p>
                  <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>Ya tienes movimientos ilimitados.</p>
                </div>
                <button onClick={() => setUpgradedBanner(false)}
                  className="text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center"
                  style={{ color: 'var(--brand-mid)' }}
                >×</button>
              </div>
            )}

            {/* Banner plan Free */}
            {profile?.plan === 'free' && (
              <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2" style={{ border: '1px solid var(--brand-border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Plan Free</p>
                  <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>{profile.movementsToday}/10 hoy</p>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--brand-border)' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{
                    width: `${Math.min((profile.movementsToday / 10) * 100, 100)}%`,
                    background: profile.movementsToday >= 10 ? 'var(--danger)' : 'var(--brand)',
                  }} />
                </div>
                <button onClick={handleUpgrade} disabled={checkoutLoading}
                  className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[44px] transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--brand)' }}
                >
                  {checkoutLoading ? 'Redirigiendo...' : 'Actualizar a Pro — $99/mes'}
                </button>
              </div>
            )}

            {/* Panel plan Pro */}
            {profile?.plan === 'pro' && (
              <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between" style={{ border: '1px solid var(--brand-border)' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>Plan Pro activo ✓</p>
                  <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>Movimientos ilimitados</p>
                </div>
                <button onClick={handlePortal} disabled={portalLoading}
                  className="text-xs font-medium px-3 py-2 rounded-lg border min-h-[36px] transition-opacity disabled:opacity-60"
                  style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
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
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  )
}

