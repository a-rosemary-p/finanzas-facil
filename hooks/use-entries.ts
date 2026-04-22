'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcMetrics } from '@/lib/utils'
import type { Entry, Movement, DateFilter, TypeFilter, DashboardMetrics, Plan } from '@/types'

const PAGE_SIZE = 10

function toMovement(row: Record<string, unknown>): Movement {
  return {
    id:           row['id']            as string,
    type:         row['type']          as Movement['type'],
    amount:       Number(row['amount']),
    description:  row['description']   as string,
    category:     row['category']      as Movement['category'],
    movementDate: row['movement_date'] as string,
    isInvestment: (row['is_investment'] as boolean) ?? false,
  }
}

export function useEntries() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ income: 0, expenses: 0, net: 0 })
  const [filter, setFilterState] = useState<DateFilter>('month')
  const [selectedMonth, setSelectedMonthState] = useState<Date | undefined>(undefined)
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>('all')
  const [showInvestments, setShowInvestmentsState] = useState(false)
  const [showPendientes, setShowPendientesState] = useState(true)
  const [customRange, setCustomRangeState] = useState<{ from: string; to: string } | null>(null)
  const [pendingMovements, setPendingMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // Refs for stable access inside callbacks
  const typeFilterRef      = useRef<TypeFilter>('all')
  const showInvestmentsRef = useRef(false)
  const showPendientesRef  = useRef(true)
  const planRef            = useRef<Plan>('free')
  const customRangeRef     = useRef<{ from: string; to: string } | null>(null)
  const totalRef           = useRef(0)
  // Stores serialised base query params so loadMore can reuse them
  const baseParamsRef      = useRef<string>('')
  // Tracks current movements array length without depending on state
  const movementsLenRef    = useRef(0)

  // ── Build URLSearchParams for the movements API ──────────────────────────
  function buildParams(
    f: DateFilter,
    tf: TypeFilter,
    showInv: boolean,
    showPend: boolean,
    selMonth?: Date,
    cRange?: { from: string; to: string } | null
  ): URLSearchParams {
    const p = new URLSearchParams({
      filter:          f,
      type:            tf,
      showPendientes:  String(showPend),
      showInvestments: String(showInv),
    })
    if (selMonth) p.set('selectedMonth', selMonth.toISOString().slice(0, 7))
    if (f === 'custom' && cRange) {
      p.set('from', cRange.from)
      p.set('to', cRange.to)
    }
    return p
  }

  // ── loadData — full refresh (page 0) ──────────────────────────────────────
  const loadData = useCallback(async (
    f: DateFilter,
    tf: TypeFilter = 'all',
    selMonth?: Date,
    showInv = false,
    showPend = true,
    plan: Plan = planRef.current,
    cRange?: { from: string; to: string }
  ) => {
    setLoading(true)
    setMovements([])
    setHasMore(false)
    movementsLenRef.current = 0

    typeFilterRef.current     = tf
    showInvestmentsRef.current = showInv
    showPendientesRef.current  = showPend
    planRef.current            = plan
    if (cRange !== undefined) customRangeRef.current = cRange

    const baseParams = buildParams(f, tf, showInv, showPend, selMonth, customRangeRef.current)
    baseParamsRef.current = baseParams.toString()

    const res = await fetch(
      `/api/movements?${baseParams}&offset=0&pageSize=${PAGE_SIZE}`
    )

    if (!res.ok) {
      // 403 = Pro feature; just show empty state, don't crash
      setLoading(false)
      return
    }

    const data = await res.json() as {
      movements: Movement[]
      total: number
      metrics: DashboardMetrics
    }

    movementsLenRef.current = data.movements.length
    setMovements(data.movements)
    setMetrics(data.metrics)
    totalRef.current = data.total
    setHasMore(data.total > PAGE_SIZE)
    setLoading(false)
  }, [])

  // ── loadMore — next page ──────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!baseParamsRef.current) return
    setLoadingMore(true)

    const offset = movementsLenRef.current
    const res = await fetch(
      `/api/movements?${baseParamsRef.current}&offset=${offset}&pageSize=${PAGE_SIZE}`
    )

    if (!res.ok) { setLoadingMore(false); return }

    const data = await res.json() as { movements: Movement[]; total: number }
    const newTotal = offset + data.movements.length

    movementsLenRef.current = newTotal
    setMovements(prev => [...prev, ...data.movements])
    setHasMore(newTotal < (data.total ?? totalRef.current))
    setLoadingMore(false)
  }, [])

  // ── Filter setters ────────────────────────────────────────────────────────
  function setFilter(f: DateFilter) {
    setFilterState(f)
    if (f !== 'custom') {
      setCustomRangeState(null)
      customRangeRef.current = null
    }
    loadData(f, typeFilter, selectedMonth, showInvestments, showPendientes)
  }

  function setCustomRange(from: string, to: string) {
    const range = { from, to }
    setCustomRangeState(range)
    customRangeRef.current = range
    setFilterState('custom')
    setSelectedMonthState(undefined)
    loadData('custom', typeFilter, undefined, showInvestments, showPendientes, planRef.current, range)
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

  // ── Pending movements ─────────────────────────────────────────────────────
  const loadPendings = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('movements')
      .select('id, type, amount, description, category, movement_date, is_investment')
      .eq('type', 'pendiente')
      .order('movement_date', { ascending: true })
      .limit(20)
    setPendingMovements((data ?? []).map(r => toMovement(r as Record<string, unknown>)))
  }, [])

  async function markAsPaid(id: string): Promise<Movement | null> {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/movements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gasto', movementDate: today }),
    })
    if (!res.ok) return null
    const data = await res.json() as { movement: Movement }
    const updated = data.movement
    setPendingMovements(prev => prev.filter(m => m.id !== id))
    updateMovement(updated)
    return updated
  }

  // ── Optimistic UI helpers ─────────────────────────────────────────────────
  function prependEntry(entry: Entry) {
    const newMovs = entry.movements
    movementsLenRef.current += newMovs.length
    setMovements(prev => [...newMovs, ...prev])

    const newPending = newMovs.filter(m => m.type === 'pendiente')
    if (newPending.length > 0) {
      setPendingMovements(prev =>
        [...prev, ...newPending].sort((a, b) => a.movementDate.localeCompare(b.movementDate))
      )
    }

    totalRef.current += newMovs.length
    setMetrics(prev => {
      const delta = calcMetrics(
        newMovs.map(m => ({ type: m.type, amount: m.amount, isInvestment: m.isInvestment })),
        showInvestmentsRef.current
      )
      return {
        income:   prev.income   + delta.income,
        expenses: prev.expenses + delta.expenses,
        net:      prev.net      + delta.net,
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
    if (updated.type !== 'pendiente') {
      setPendingMovements(prev => prev.filter(m => m.id !== updated.id))
    }
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
      movementsLenRef.current = Math.max(0, movementsLenRef.current - 1)
      totalRef.current = Math.max(0, totalRef.current - 1)
      return prev.filter(m => m.id !== id)
    })
    setPendingMovements(prev => prev.filter(m => m.id !== id))
  }

  return {
    movements, metrics, filter, selectedMonth, typeFilter,
    showInvestments, showPendientes, customRange,
    setFilter, setTypeFilter, setSelectedMonth,
    setShowInvestments, setShowPendientes, setCustomRange,
    loadData, loadMore, loading, loadingMore, hasMore,
    prependEntry, updateMovement, deleteMovement,
    pendingMovements, loadPendings, markAsPaid,
  }
}
