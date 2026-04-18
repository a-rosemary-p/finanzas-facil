'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useEntries } from '@/hooks/use-entries'
import { EntryCard } from '@/components/entries/entry-card'
import { formatCurrency, getTodayString } from '@/lib/utils'
import { DATE_FILTER_LABELS } from '@/lib/constants'
import type { DateFilter } from '@/types'

const FILTERS: DateFilter[] = ['today', '7days', 'month', 'year']

function getFechaFormateada(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function DashboardPage() {
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
  } = useEntries()

  // Carga inicial de datos
  useEffect(() => {
    if (profile) loadData('today')
  }, [profile, loadData])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: '#5A7A8A' }}>Cargando...</p>
      </div>
    )
  }

  const neto = metrics.net

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="bg-white sticky top-0 z-10 flex items-center justify-between px-4 h-14"
        style={{
          borderBottom: '1px solid #E0E0E0',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <span className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
          💰 FinanzasFácil
        </span>

        <div className="flex items-center gap-3">
          {/* Badge de plan */}
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={
              profile?.plan === 'pro'
                ? { background: '#2E7D32', color: '#fff' }
                : { background: '#E0E0E0', color: '#5A7A8A' }
            }
          >
            {profile?.plan === 'pro' ? 'Pro' : 'Free'}
          </span>

          {/* Logout */}
          <button
            onClick={logout}
            className="text-sm min-h-[44px] min-w-[44px] flex items-center justify-end transition-colors"
            style={{ color: '#5A7A8A' }}
          >
            Salir
          </button>
        </div>
      </header>

      <main
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Saludo */}
        <div>
          <p className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
            Hola, {profile?.displayName} 👋
          </p>
          <p className="text-sm italic capitalize" style={{ color: '#5A7A8A' }}>
            {getFechaFormateada()}
          </p>
        </div>

        {/* Formulario de entrada — se completa en Paso 1.5 */}
        <div
          className="bg-white rounded-xl shadow-sm p-4"
          style={{ border: '1px solid #E0E0E0' }}
        >
          <p className="font-bold mb-3" style={{ color: '#1A2B3A' }}>
            ¿Qué pasó hoy en tu negocio?
          </p>
          <textarea
            placeholder="Ej: vendí 1,500 en tacos, gasté 300 en tortillas..."
            rows={3}
            disabled
            className="w-full border rounded-lg p-3 text-sm resize-none"
            style={{
              borderColor: '#E0E0E0',
              color: '#5A7A8A',
              background: '#FAFAFA',
            }}
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              defaultValue={getTodayString()}
              disabled
              className="border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: '#E0E0E0', color: '#5A7A8A' }}
            />
          </div>
          <button
            disabled
            className="mt-3 w-full text-white rounded-xl py-3.5 font-bold text-base opacity-40 min-h-[52px]"
            style={{ background: '#2E7D32' }}
          >
            Registrar
          </button>
          <p className="text-xs text-center mt-2" style={{ color: '#5A7A8A' }}>
            Procesamiento con IA disponible pronto
          </p>
        </div>

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
          <MetricCard label="Ingresos" value={metrics.income} color="#2E7D32" bg="#F0FAF4" sign="+" />
          <MetricCard label="Gastos" value={metrics.expenses} color="#C62828" bg="#FFF5F5" sign="−" />
          <MetricCard
            label="Neto"
            value={neto}
            color={neto >= 0 ? '#2E7D32' : '#C62828'}
            bg={neto >= 0 ? '#F0FAF4' : '#FFF5F5'}
            sign={neto >= 0 ? '+' : '−'}
          />
        </div>

        {/* Historial */}
        <section className="flex flex-col gap-3">
          <h2 className="font-bold" style={{ color: '#1A2B3A' }}>
            {filter === 'today' ? 'Registros de hoy' : `Registros — ${DATE_FILTER_LABELS[filter]}`}
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
                Usa el formulario de arriba para agregar tu primer movimiento.
              </p>
            </div>
          ) : (
            <>
              {entries.map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))}

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-colors border min-h-[44px]"
                  style={{
                    borderColor: '#2E7D32',
                    color: '#2E7D32',
                    background: '#fff',
                  }}
                >
                  {loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </>
          )}
        </section>

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
                {profile.movementsToday}/10 movimientos hoy
              </p>
            </div>
            <div
              className="w-full rounded-full h-1.5"
              style={{ background: '#E0E0E0' }}
            >
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min((profile.movementsToday / 10) * 100, 100)}%`,
                  background: profile.movementsToday >= 10 ? '#C62828' : '#2E7D32',
                }}
              />
            </div>
            <button
              className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[44px] transition-opacity"
              style={{ background: '#2E7D32' }}
            >
              Actualizar a Pro — $99/mes
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// Componente de métrica inline (simple, no necesita archivo propio)
function MetricCard({
  label,
  value,
  color,
  bg,
  sign,
}: {
  label: string
  value: number
  color: string
  bg: string
  sign: string
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1 min-w-0"
      style={{ background: bg }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wide truncate"
        style={{ color: '#5A7A8A' }}
      >
        {label}
      </span>
      <span
        className="text-base font-bold truncate leading-tight"
        style={{ color }}
      >
        {sign}{formatCurrency(value)}
      </span>
    </div>
  )
}
