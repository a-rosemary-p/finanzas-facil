'use client'

/**
 * /movimientos — explorador completo de movimientos. Nuevo en v0.29.
 *
 * Reemplaza el rol que tenía /reportes Este período hasta v0.281 (lista de
 * movimientos editables). /reportes ahora es solo para analítica; aquí vive
 * el "ver todo + editar".
 *
 * Filtros:
 *  - Fecha: hoy / semana / mes (Free + Pro), año + custom (Pro only)
 *  - Categoría (multi-select chips): ingresos / gastos / inversiones / pendientes / recurrentes
 *
 * Lista: paginación "Cargar más" (30 por batch). Cada fila usa <MovementCard>
 * con edit inline + delete + marcar pendiente como pagado (los hooks ya existen).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { WaveSection } from '@/components/ui/wave'
import { MovementCard } from '@/components/entries/entry-card'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { useAuth } from '@/hooks/use-auth'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { track } from '@/lib/analytics'
import { getDateRange, formatRangeShort } from '@/lib/utils'
import type { Movement, DateFilter } from '@/types'

type Category = 'ingresos' | 'gastos' | 'inversiones' | 'pendientes' | 'recurrentes'

const ALL_CATEGORIES: Category[] = ['ingresos', 'gastos', 'inversiones', 'pendientes', 'recurrentes']

const CATEGORY_LABEL: Record<Category, string> = {
  ingresos:    'Ingresos',
  gastos:      'Gastos',
  inversiones: 'Inversiones',
  pendientes:  'Pendientes',
  recurrentes: 'Recurrentes',
}

const CATEGORY_CHIP_ACTIVE: Record<Category, string> = {
  ingresos:    'bg-income-bg text-income-text border-income-border',
  gastos:      'bg-expense-bg text-expense-text border-expense-border',
  inversiones: 'bg-pending-bg text-pending-text border-pending-border',
  pendientes:  'bg-pending-bg text-pending-text border-pending-border',
  recurrentes: 'bg-brand-chip text-brand border-brand-light',
}

interface DateFilterOption {
  id: DateFilter
  label: string
  proOnly?: boolean
}

const DATE_OPTIONS: DateFilterOption[] = [
  { id: 'today',  label: 'Hoy' },
  { id: '7days',  label: 'Semana' },
  { id: 'month',  label: 'Mes' },
  { id: 'year',   label: 'Año',    proOnly: true },
  { id: 'custom', label: 'Rango',  proOnly: true },
]

const PAGE_SIZE = 30

export default function MovimientosPage() {
  const { profile, loading: authLoading } = useAuth()
  const isPro = profile?.plan === 'pro'

  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  // Inicializamos en null para esperar al profile y aplicar los defaults
  // de Ajustes (mostrarInversiones / mostrarPendientes). Si arrancáramos con
  // todas las categorías y luego ajustáramos en un useEffect, el primer fetch
  // se dispararía con un set incorrecto y luego se descartaría — gasto inútil.
  const [categories, setCategories] = useState<Set<Category> | null>(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Aplica los toggles de /ajustes como estado inicial de los chips.
  // mostrarInversiones=false ⇒ chip Inversiones empieza apagado.
  // mostrarPendientes=false ⇒ chip Pendientes empieza apagado.
  // Los recurrentes / ingresos / gastos siempre arrancan activos.
  useEffect(() => {
    if (!profile || categories) return
    const next = new Set<Category>(ALL_CATEGORIES)
    if (profile.mostrarInversiones === false) next.delete('inversiones')
    if (profile.mostrarPendientes === false) next.delete('pendientes')
    // Edge: si los dos toggles están off, nos quedan 3 categorías (ingresos,
    // gastos, recurrentes). Si por alguna razón quedaran 0, fallback a todas
    // (la UI no permite 0).
    if (next.size === 0) ALL_CATEGORIES.forEach(c => next.add(c))
    setCategories(next)
  }, [profile, categories])

  const [movements, setMovements] = useState<Movement[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const categoriesArr = useMemo(() => categories ? Array.from(categories) : [], [categories])

  // Rango activo formateado para mostrar debajo del toggle. Calculado
  // client-side para feedback inmediato; el server aplica el mismo cálculo
  // (más cap Free de 30d) y devuelve enforcedRange en la respuesta.
  // Para `custom` solo lo mostramos si ambos pickers tienen valor.
  const rangoLabel = useMemo(() => {
    if (dateFilter === 'custom') {
      if (!customFrom || !customTo) return null
      return formatRangeShort(customFrom, customTo)
    }
    const { start, end } = getDateRange(dateFilter, undefined, undefined, undefined)
    return formatRangeShort(start, end)
  }, [dateFilter, customFrom, customTo])

  const buildUrl = useCallback((newOffset: number) => {
    const params = new URLSearchParams()
    params.set('filter', dateFilter)
    if (dateFilter === 'custom' && customFrom && customTo) {
      params.set('from', customFrom)
      params.set('to', customTo)
    }
    if (categoriesArr.length < ALL_CATEGORIES.length && categoriesArr.length > 0) {
      params.set('categories', categoriesArr.join(','))
    }
    params.set('offset', String(newOffset))
    params.set('pageSize', String(PAGE_SIZE))
    return `/api/movimientos?${params.toString()}`
  }, [dateFilter, customFrom, customTo, categoriesArr])

  // Fetch inicial (offset 0) cuando cambian filtros
  useEffect(() => {
    if (!profile || !categories) return
    if (dateFilter === 'custom' && (!customFrom || !customTo)) return
    let cancelled = false
    setLoading(true)
    setError('')
    setOffset(0)

    fetchWithAuthRetry(buildUrl(0))
      .then(r => r.json())
      .then((d: { movements?: Movement[]; total?: number; error?: string }) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          setMovements([])
          setTotal(0)
        } else {
          setMovements(d.movements ?? [])
          setTotal(d.total ?? 0)
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('No pudimos cargar los movimientos.')
        setLoading(false)
      })

    track('movements_filter_changed', {
      date_filter: dateFilter,
      categories: categoriesArr,
    })

    return () => { cancelled = true }
  }, [profile, dateFilter, customFrom, customTo, categoriesArr, buildUrl])

  async function loadMore() {
    if (loadingMore || movements.length >= total) return
    setLoadingMore(true)
    try {
      const nextOffset = offset + PAGE_SIZE
      const res = await fetchWithAuthRetry(buildUrl(nextOffset))
      const data = await res.json() as { movements?: Movement[]; total?: number }
      setMovements(prev => [...prev, ...(data.movements ?? [])])
      setTotal(data.total ?? total)
      setOffset(nextOffset)
    } catch {
      // Fail silent, user puede reintentar
    } finally {
      setLoadingMore(false)
    }
  }

  function toggleCategory(cat: Category) {
    setCategories(prev => {
      if (!prev) return prev
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      // Si se queda vacío al toggle off, dejamos al menos uno (no permitimos
      // cero categorías porque la UI quedaría sin nada).
      if (next.size === 0) return prev
      return next
    })
  }

  function selectAllCategories() {
    setCategories(new Set(ALL_CATEGORIES))
  }

  if (authLoading || !categories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    )
  }

  const hasActiveCustom = dateFilter === 'custom' && customFrom && customTo
  const showResults = dateFilter !== 'custom' || hasActiveCustom

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5 fz-pad-safe-bottom">
        <div>
          <h1 className="font-bold text-lg text-brand">Movimientos</h1>
          <p className="text-sm mt-0.5 text-brand-mid">
            Tu historial completo. Filtra y edita lo que necesites.
          </p>
          <div className="mt-3">
            <WaveSection />
          </div>
        </div>

        {/* Filtro de fecha */}
        <div className="flex flex-col gap-2">
          <p className="fz-eyebrow">Período</p>
          <div className="flex gap-1 p-1 rounded-xl bg-brand-chip border border-brand-border overflow-x-auto no-scrollbar">
            {DATE_OPTIONS.map(opt => {
              const active = dateFilter === opt.id
              const accessible = isPro || !opt.proOnly
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={accessible ? () => setDateFilter(opt.id) : () => { void startProCheckout() }}
                  className={[
                    'flex-1 min-w-fit text-xs font-bold rounded-lg min-h-[36px] px-3 transition-colors flex items-center justify-center gap-1',
                    active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                    accessible ? '' : 'opacity-60',
                  ].join(' ')}
                >
                  {opt.proOnly && !accessible && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Rango activo — debajo del toggle, alinea a la izquierda. Hace
            * inequívoco qué fechas cubre el filtro elegido (especialmente
            * para "Mes" que es rolling 30d, no calendario). */}
          {rangoLabel && (
            <p className="text-xs text-brand-muted px-1 mt-0.5">
              {rangoLabel}
            </p>
          )}

          {/* Pickers de rango custom */}
          {dateFilter === 'custom' && isPro && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <label className="flex flex-col gap-1">
                <span className="fz-input-label">Desde</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="fz-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="fz-input-label">Hasta</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                  className="fz-input"
                />
              </label>
            </div>
          )}
        </div>

        {/* Filtro de categorías */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="fz-eyebrow">Categorías</p>
            {categoriesArr.length < ALL_CATEGORIES.length && (
              <button
                type="button"
                onClick={selectAllCategories}
                className="text-[11px] font-medium underline text-brand-mid"
              >
                Seleccionar todas
              </button>
            )}
          </div>
          {/* 5 chips distribuidos al ancho completo de la columna. text-[10px]
           * y padding mínimo para que "Recurrentes"/"Inversiones" quepan sin
           * truncar en mobile (~360px). */}
          <div className="grid grid-cols-5 gap-1">
            {ALL_CATEGORIES.map(cat => {
              const active = categories.has(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={[
                    'text-[10px] font-bold px-1 py-1.5 rounded-full border transition-colors text-center min-h-[30px]',
                    active
                      ? CATEGORY_CHIP_ACTIVE[cat]
                      : 'bg-white text-ink-300 border-brand-border',
                  ].join(' ')}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Resultados */}
        {!showResults ? (
          <div className="fz-empty-card text-brand-mid">
            <p className="text-sm">Selecciona el rango de fechas para ver los movimientos.</p>
          </div>
        ) : loading ? (
          <p className="text-sm text-center py-8 text-brand-mid">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-center py-8 text-danger">{error}</p>
        ) : movements.length === 0 ? (
          <div className="fz-empty-card text-brand-mid">
            <p className="text-sm font-medium text-brand">Sin movimientos</p>
            <p className="text-xs mt-1.5">No hay movimientos con los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-brand-mid">
                {movements.length} de {total}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {movements.map(m => (
                <MovementCard
                  key={m.id}
                  movement={m}
                  onUpdated={updated =>
                    setMovements(prev => prev.map(x => x.id === updated.id ? updated : x))
                  }
                  onDeleted={id => {
                    setMovements(prev => prev.filter(x => x.id !== id))
                    setTotal(t => Math.max(0, t - 1))
                  }}
                  hideDate={false}
                />
              ))}
            </div>

            {movements.length < total && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full h-11 rounded-xl text-sm font-semibold transition-colors bg-paper-soft border border-brand-border text-brand backdrop-blur-md disabled:opacity-60"
              >
                {loadingMore ? 'Cargando…' : `Cargar más (${total - movements.length} restantes)`}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
