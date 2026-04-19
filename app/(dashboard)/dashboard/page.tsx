'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useEntries } from '@/hooks/use-entries'
import { MovementDayGroup } from '@/components/entries/movement-day-group'
import { EntryForm } from '@/components/entries/entry-form'
import { ConfirmationScreen } from '@/components/entries/confirmation-screen'
import { formatCurrency, getPeriodLabel, groupMovementsByDate } from '@/lib/utils'
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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toLowerCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Componente de la caja de filtros (Cambio 4) ────────────────────────────

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7days', label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Histórico' },
]

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function FilterBox({
  filter,
  selectedMonth,
  onSetFilter,
  onSetMonth,
}: {
  filter: DateFilter
  selectedMonth: Date | undefined
  onSetFilter: (f: DateFilter) => void
  onSetMonth: (d: Date) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() =>
    selectedMonth ? selectedMonth.getFullYear() : new Date().getFullYear()
  )

  const periodLabel = getPeriodLabel(filter, selectedMonth)

  function selectFilter(f: DateFilter) {
    onSetFilter(f)
    setExpanded(false)
    setPickerOpen(false)
  }

  function selectMonth(month: number) {
    const d = new Date(pickerYear, month, 1)
    onSetMonth(d)
    setPickerOpen(false)
    setExpanded(false)
  }

  // Años disponibles: desde 2023 hasta el año actual
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear; y >= 2023; y--) years.push(y)

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      style={{ border: '1px solid #E0E0E0' }}
    >
      {/* Fila colapsada: muestra período activo */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Label tappable — abre picker de mes si el filtro es 'month' */}
        <button
          type="button"
          onClick={() => {
            if (filter === 'month' || !expanded) {
              setPickerOpen(v => !v)
              if (!expanded) setExpanded(true)
            }
          }}
          className="flex items-center gap-2 text-sm font-bold min-h-[36px]"
          style={{ color: '#1B5E20' }}
        >
          <span>📅</span>
          <span>{periodLabel}</span>
        </button>

        {/* Botón expandir/colapsar opciones */}
        <button
          type="button"
          onClick={() => { setExpanded(v => !v); setPickerOpen(false) }}
          className="p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
          style={{ color: '#5A7A8A', background: '#F5F5F5' }}
          aria-label={expanded ? 'Colapsar filtros' : 'Expandir filtros'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Picker de mes — aparece cuando pickerOpen */}
      {pickerOpen && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: '#F0F0F0' }}>
          {/* Navegación de año */}
          <div className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => setPickerYear(y => y + 1)}
              disabled={pickerYear >= currentYear}
              className="p-1.5 rounded min-h-[36px] min-w-[36px] disabled:opacity-30"
              style={{ color: '#5A7A8A' }}
              aria-label="Año siguiente"
            >
              ◀
            </button>
            <span className="text-sm font-bold" style={{ color: '#1A2B3A' }}>{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear(y => y - 1)}
              disabled={pickerYear <= 2023}
              className="p-1.5 rounded min-h-[36px] min-w-[36px] disabled:opacity-30"
              style={{ color: '#5A7A8A' }}
              aria-label="Año anterior"
            >
              ▶
            </button>
          </div>
          {/* Grid de meses */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_ES.map((label, idx) => {
              const isActive =
                filter === 'month' &&
                selectedMonth &&
                selectedMonth.getMonth() === idx &&
                selectedMonth.getFullYear() === pickerYear
              const isCurrentMonth =
                !selectedMonth &&
                filter === 'month' &&
                new Date().getMonth() === idx &&
                new Date().getFullYear() === pickerYear
              const active = isActive || isCurrentMonth
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectMonth(idx)}
                  className="py-2 rounded-lg text-xs font-medium min-h-[36px] transition-colors"
                  style={
                    active
                      ? { background: '#2E7D32', color: '#fff' }
                      : { background: '#F5F5F5', color: '#5A7A8A' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Opciones expandidas */}
      {expanded && !pickerOpen && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: '#F0F0F0' }}>
          <div className="flex flex-wrap gap-2 pt-3">
            {DATE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectFilter(opt.value)}
                className="px-3 py-2 rounded-full text-sm font-medium border min-h-[40px] transition-colors"
                style={
                  filter === opt.value && opt.value !== 'month'
                    ? { background: '#2E7D32', color: '#fff', borderColor: '#2E7D32' }
                    : { background: '#fff', color: '#5A7A8A', borderColor: '#E0E0E0' }
                }
              >
                {opt.label}
              </button>
            ))}
            {/* Rango avanzado — solo UI */}
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                // Mostrar mensaje simple via alert — en producción sería un toast
                alert('Próximamente: filtros por fecha personalizada')
              }}
              className="px-3 py-2 rounded-full text-sm font-medium border min-h-[40px] transition-colors"
              style={{ background: '#fff', color: '#9E9E9E', borderColor: '#E0E0E0' }}
            >
              ⚙ Rango avanzado...
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard principal ─────────────────────────────────────────────────────

function DashboardInner() {
  const { profile, loading: authLoading, logout } = useAuth()
  const {
    movements,
    metrics,
    filter,
    selectedMonth,
    typeFilter,
    showInvestments,
    setFilter,
    setTypeFilter,
    setSelectedMonth,
    setShowInvestments,
    loadData,
    loadMore,
    loading,
    loadingMore,
    hasMore,
    prependEntry,
    updateMovement,
    deleteMovement,
  } = useEntries()

  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('dashboard')
  const [pendingData, setPendingData] = useState<PendingData | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradedBanner, setUpgradedBanner] = useState(false)

  useEffect(() => {
    if (profile) loadData('month')
  }, [profile, loadData])

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
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch { /* silently ignore */ }
    finally { setCheckoutLoading(false) }
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch { /* silently ignore */ }
    finally { setPortalLoading(false) }
  }, [])

  function handleMovementsExtracted(data: PendingData) {
    setPendingData(data)
    setMode('confirming')
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
  const periodLabel = getPeriodLabel(filter, selectedMonth)

  // Agrupar movimientos por fecha para Cambio 5
  const grouped = groupMovementsByDate(movements)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Últimas 2 fechas expandidas por default, el resto colapsado
  const today = new Date().toISOString().split('T')[0]
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()

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
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {mode === 'confirming' && pendingData ? (
          <ConfirmationScreen
            rawText={pendingData.rawText}
            entryDate={pendingData.entryDate}
            initialMovements={pendingData.movements}
            onConfirmed={handleConfirmed}
            onCancel={handleCancel}
          />
        ) : (
          <>
            {/* 1. Saludo */}
            <div>
              <p className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
                Hola, {profile?.displayName} 👋
              </p>
              <p className="text-sm italic capitalize" style={{ color: '#5A7A8A' }}>
                {getFechaFormateada()}
              </p>
            </div>

            {/* 2. Formulario de entrada */}
            <EntryForm onMovementsExtracted={handleMovementsExtracted} />

            {/* 3. Etiqueta de período + métricas */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: '#1B5E20' }}>
                  {periodLabel}
                </p>
                {/* Toggle inversiones */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInvestments}
                    onChange={e => setShowInvestments(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500"
                  />
                  <span className="text-xs" style={{ color: '#9E9E9E' }}>📈 Incluir inversiones</span>
                </label>
              </div>
              <div
                className="w-full"
                style={{ height: '1px', background: '#C8E6C9' }}
              />

              {/* Tarjetas de métricas */}
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
            </div>

            {/* 4. Caja de filtros (fecha + tipo) */}
            <div className="flex flex-col gap-3">
              <FilterBox
                filter={filter}
                selectedMonth={selectedMonth}
                onSetFilter={(f: DateFilter) => setFilter(f)}
                onSetMonth={(d: Date) => setSelectedMonth(d)}
              />

              {/* Filtro de tipo */}
              <div className="flex gap-2">
                {TYPE_FILTER_CONFIG.map(tf => {
                  const active = typeFilter === tf.value
                  return (
                    <button
                      key={tf.value}
                      onClick={() => setTypeFilter(tf.value as TypeFilter)}
                      className="flex-1 py-2 rounded-full text-xs font-bold transition-colors border min-h-[36px]"
                      style={
                        active
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

            {/* 5. Historial agrupado por fecha */}
            <section className="flex flex-col gap-4">
              <h2 className="font-bold" style={{ color: '#1A2B3A' }}>
                Registros
                {typeFilter !== 'all' && (
                  <span className="ml-2 text-sm font-medium" style={{ color: '#5A7A8A' }}>
                    · {TYPE_FILTER_CONFIG.find(t => t.value === typeFilter)?.label}
                  </span>
                )}
              </h2>

              {loading ? (
                <p className="text-sm text-center py-8" style={{ color: '#5A7A8A' }}>
                  Cargando...
                </p>
              ) : sortedDates.length === 0 ? (
                <div
                  className="bg-white rounded-xl shadow-sm p-6 text-center"
                  style={{ border: '1px solid #E0E0E0' }}
                >
                  <p className="text-sm" style={{ color: '#5A7A8A' }}>
                    Sin registros para este período.
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#5A7A8A' }}>
                    Escribe arriba lo que pasó en tu negocio.
                  </p>
                </div>
              ) : (
                <>
                  {sortedDates.map(date => (
                    <MovementDayGroup
                      key={date}
                      date={date}
                      movements={grouped[date]}
                      defaultExpanded={date === today || date === yesterday}
                      onUpdated={updateMovement}
                      onDeleted={deleteMovement}
                    />
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
