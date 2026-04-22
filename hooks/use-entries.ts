'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDateRange } from '@/lib/utils'
import { PLANS } from '@/lib/constants'
import type { Entry, Movement, DateFilter, TypeFilter, DashboardMetrics, Plan } from '@/types'

const PAGE_SIZE = 20

function toMovement(row: Record<string, unknown>): Movement {
  return {
    id: row['id'] as string,
    type: row['type'] as Movement['type'],
    amount: Number(row['amount']),
    description: row['description'] as string,
    category: row['category'] as Movement['category'],
    movementDate: row['movement_date'] as string,
    isInvestment: (row['is_investment'] as boolean) ?? false,
  }
}

function calcMetrics(
  rows: { type: string; amount: number; isInvestment: boolean }[],
  showInvestments: boolean
): DashboardMetrics {
  let income = 0
  let expenses = 0
  for (const m of rows) {
    if (!showInvestments && m.isInvestment) continue
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

export function useEntries() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ income: 0, expenses: 0, net: 0 })
  const [filter, setFilterState] = useState<DateFilter>('month')
  const [selectedMonth, setSelectedMonthState] = useState<Date | undefined>(undefined)
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>('all')
  const [showInvestments, setShowInvestmentsState] = useState(false)
  const [showPendientes, setShowPendientesState] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const rangeRef = useRef<{ start: string; end: string } | null>(null)
  const typeFilterRef = useRef<TypeFilter>('all')
  const showInvestmentsRef = useRef(false)
  const showPendientesRef = useRef(true)
  const planRef = useRef<Plan>('free')
  const totalRef = useRef(0)

  const loadData = useCallback(async (
    f: DateFilter,
    tf: TypeFilter = 'all',
    selMonth?: Date,
    showInv = false,
    showPend = true,
    plan: Plan = planRef.current
  ) => {
    setLoading(true)
    setMovements([])
    setHasMore(false)
    typeFilterRef.current = tf
    showInvestmentsRef.current = showInv
    showPendientesRef.current = showPend
    planRef.current = plan

    // Límite de historial: Free = 30 días, Pro = sin límite
    const maxHistory = plan === 'free' ? PLANS.FREE.historyDays : undefined

    const supabase = createClient()
    const range = getDateRange(f, selMonth, maxHistory)
    rangeRef.current = range
    const { start, end } = range

    // 1. Métricas — sin filtro de tipo, respeta showInvestments
    const { data: metricsRows } = await supabase
      .from('movements')
      .select('type, amount, is_investment')
      .gte('movement_date', start)
      .lte('movement_date', end)

    setMetrics(calcMetrics(
      (metricsRows ?? []).map(r => ({
        type: r['type'] as string,
        amount: Number(r['amount']),
        isInvestment: (r['is_investment'] as boolean) ?? false,
      })),
      showInv
    ))

    // 2. Primera página de movimientos
    let baseQuery = supabase
      .from('movements')
      .select('id, type, amount, description, category, movement_date, is_investment', { count: 'exact' })
      .gte('movement_date', start)
      .lte('movement_date', end)

    // Filtro por tipo: si es 'all' y showPend=false, excluir pendientes
    if (tf !== 'all') {
      baseQuery = baseQuery.eq('type', tf) as typeof baseQuery
    } else if (!showPend) {
      baseQuery = baseQuery.neq('type', 'pendiente') as typeof baseQuery
    }

    const { data: pageRows, count } = await baseQuery
      .order('movement_date', { ascending: false })
      .order('id', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    const total = count ?? 0
    totalRef.current = total
    setMovements((pageRows ?? []).map(r => toMovement(r as Record<string, unknown>)))
    setHasMore(total > PAGE_SIZE)
    setLoading(false)
  }, [])

  const loadMore = useCallback(async () => {
    const range = rangeRef.current
    if (!range) return
    const tf = typeFilterRef.current
    const showPend = showPendientesRef.current

    setLoadingMore(true)
    const supabase = createClient()

    setMovements(prev => {
      const offset = prev.length

      let base = supabase
        .from('movements')
        .select('id, type, amount, description, category, movement_date, is_investment')
        .gte('movement_date', range.start)
        .lte('movement_date', range.end)

      if (tf !== 'all') {
        base = base.eq('type', tf) as typeof base
      } else if (!showPend) {
        base = base.neq('type', 'pendiente') as typeof base
      }

      base
        .order('movement_date', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
        .then(({ data: moreRows }) => {
          const rows = (moreRows ?? []).map(r => toMovement(r as Record<string, unknown>))
          setMovements(p => {
            const updated = [...p, ...rows]
            setHasMore(updated.length < totalRef.current)
            return updated
          })
          setLoadingMore(false)
        })

      return prev
    })
  }, [])

  function setFilter(f: DateFilter) {
    setFilterState(f)
    loadData(f, typeFilter, selectedMonth, showInvestments, showPendientes)
  }

  function setTypeFilter(tf: TypeFilter) {
    setTypeFilterState(tf)
    typeFilterRef.current = tf
    loadData(filter, tf, selectedMonth, showInvestments, showPendientes)
  }

  function setSelectedMonth(d: Date | undefined) {
    setSelectedMonthState(d)
    setFilterState('month')
    loadData('month', typeFilter, d, showInvestments, showPendientes)
  }

  function setShowInvestments(show: boolean) {
    setShowInvestmentsState(show)
    showInvestmentsRef.current = show
    loadData(filter, typeFilter, selectedMonth, show, showPendientes)
  }

  function setShowPendientes(show: boolean) {
    setShowPendientesState(show)
    showPendientesRef.current = show
    loadData(filter, typeFilter, selectedMonth, showInvestments, show)
  }

  function prependEntry(entry: Entry) {
    const newMovs = entry.movements
    setMovements(prev => [...newMovs, ...prev])
    totalRef.current += newMovs.length
    setMetrics(prev => {
      const delta = calcMetrics(
        newMovs.map(m => ({ type: m.type, amount: m.amount, isInvestment: m.isInvestment })),
        showInvestmentsRef.current
      )
      return {
        income: prev.income + delta.income,
        expenses: prev.expenses + delta.expenses,
        net: prev.net + delta.net,
      }
    })
  }

  function updateMovement(updated: Movement) {
    setMovements(prev => {
      const old = prev.find(m => m.id === updated.id)
      if (!old) return prev
      setMetrics(m => {
        const next = { ...m }
        const showInv = showInvestmentsRef.current
        if (!showInv && !old.isInvestment || showInv) {
          if (old.type === 'ingreso') next.income -= old.amount
          else if (old.type === 'gasto') next.expenses -= old.amount
        }
        if (!showInv && !updated.isInvestment || showInv) {
          if (updated.type === 'ingreso') next.income += updated.amount
          else if (updated.type === 'gasto') next.expenses += updated.amount
        }
        next.net = next.income - next.expenses
        return next
      })
      return prev.map(m => m.id === updated.id ? updated : m)
    })
  }

  function deleteMovement(id: string) {
    setMovements(prev => {
      const target = prev.find(m => m.id === id)
      if (!target) return prev
      setMetrics(m => {
        const next = { ...m }
        const showInv = showInvestmentsRef.current
        if (!showInv && !target.isInvestment || showInv) {
          if (target.type === 'ingreso') next.income -= target.amount
          else if (target.type === 'gasto') next.expenses -= target.amount
          next.net = next.income - next.expenses
        }
        return next
      })
      totalRef.current = Math.max(0, totalRef.current - 1)
      return prev.filter(m => m.id !== id)
    })
  }

  return {
    movements, metrics, filter, selectedMonth, typeFilter,
    showInvestments, showPendientes,
    setFilter, setTypeFilter, setSelectedMonth,
    setShowInvestments, setShowPendientes,
    loadData, loadMore, loading, loadingMore, hasMore,
    prependEntry, updateMovement, deleteMovement,
  }
}
