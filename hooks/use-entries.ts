'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDateRange } from '@/lib/utils'
import type { Entry, Movement, DateFilter, TypeFilter, DashboardMetrics } from '@/types'

const PAGE_SIZE = 20

function toMovement(row: Record<string, unknown>): Movement {
  return {
    id: row['id'] as string,
    type: row['type'] as Movement['type'],
    amount: Number(row['amount']),
    description: row['description'] as string,
    category: row['category'] as Movement['category'],
    movementDate: row['movement_date'] as string,
  }
}

function calcMetrics(rows: { type: string; amount: number }[]): DashboardMetrics {
  let income = 0
  let expenses = 0
  for (const m of rows) {
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

export function useEntries() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ income: 0, expenses: 0, net: 0 })
  const [filter, setFilterState] = useState<DateFilter>('today')
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>('all')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const rangeRef = useRef<{ start: string; end: string } | null>(null)
  const typeFilterRef = useRef<TypeFilter>('all')
  const totalRef = useRef(0)

  const loadData = useCallback(async (f: DateFilter, tf: TypeFilter = 'all') => {
    setLoading(true)
    setMovements([])
    setHasMore(false)
    typeFilterRef.current = tf

    const supabase = createClient()
    const range = getDateRange(f)
    rangeRef.current = range
    const { start, end } = range

    // 1. Métricas — siempre sin filtro de tipo para mostrar el cuadro completo
    const { data: metricsRows } = await supabase
      .from('movements')
      .select('type, amount')
      .gte('movement_date', start)
      .lte('movement_date', end)

    setMetrics(calcMetrics(
      (metricsRows ?? []).map(r => ({
        type: r['type'] as string,
        amount: Number(r['amount']),
      }))
    ))

    // 2. Primera página de movimientos — con filtro de tipo si aplica
    const baseQuery = supabase
      .from('movements')
      .select('id, type, amount, description, category, movement_date', { count: 'exact' })
      .gte('movement_date', start)
      .lte('movement_date', end)

    const filteredQuery = tf !== 'all' ? baseQuery.eq('type', tf) : baseQuery

    const { data: pageRows, count } = await filteredQuery
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

    setLoadingMore(true)
    const supabase = createClient()

    setMovements(prev => {
      const offset = prev.length

      const base = supabase
        .from('movements')
        .select('id, type, amount, description, category, movement_date')
        .gte('movement_date', range.start)
        .lte('movement_date', range.end)

      const q = tf !== 'all' ? base.eq('type', tf) : base

      q.order('movement_date', { ascending: false })
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
    loadData(f, typeFilter)
  }

  function setTypeFilter(tf: TypeFilter) {
    setTypeFilterState(tf)
    typeFilterRef.current = tf
    loadData(filter, tf)
  }

  // Añade los movimientos de una entrada recién confirmada al tope
  function prependEntry(entry: Entry) {
    const newMovs = entry.movements
    setMovements(prev => [...newMovs, ...prev])
    totalRef.current += newMovs.length
    setMetrics(prev => {
      const delta = calcMetrics(newMovs.map(m => ({ type: m.type, amount: m.amount })))
      return {
        income: prev.income + delta.income,
        expenses: prev.expenses + delta.expenses,
        net: prev.net + delta.net,
      }
    })
  }

  // Reemplaza un movimiento en estado y ajusta métricas
  function updateMovement(updated: Movement) {
    setMovements(prev => {
      const old = prev.find(m => m.id === updated.id)
      if (!old) return prev
      setMetrics(m => {
        const next = { ...m }
        if (old.type === 'ingreso') next.income -= old.amount
        else if (old.type === 'gasto') next.expenses -= old.amount
        if (updated.type === 'ingreso') next.income += updated.amount
        else if (updated.type === 'gasto') next.expenses += updated.amount
        next.net = next.income - next.expenses
        return next
      })
      return prev.map(m => m.id === updated.id ? updated : m)
    })
  }

  // Elimina un movimiento del estado y ajusta métricas
  function deleteMovement(id: string) {
    setMovements(prev => {
      const target = prev.find(m => m.id === id)
      if (!target) return prev
      setMetrics(m => {
        const next = { ...m }
        if (target.type === 'ingreso') next.income -= target.amount
        else if (target.type === 'gasto') next.expenses -= target.amount
        next.net = next.income - next.expenses
        return next
      })
      totalRef.current = Math.max(0, totalRef.current - 1)
      return prev.filter(m => m.id !== id)
    })
  }

  return {
    movements, metrics, filter, typeFilter, setFilter, setTypeFilter,
    loadData, loadMore, loading, loadingMore, hasMore,
    prependEntry, updateMovement, deleteMovement,
  }
}
