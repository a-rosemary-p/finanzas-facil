'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDateRange } from '@/lib/utils'
import type { Entry, Movement, DateFilter, DashboardMetrics } from '@/types'

const PAGE_SIZE = 20

// Transforma filas de Supabase (snake_case) al tipo Movement (camelCase)
function toMovement(row: Record<string, unknown>): Movement {
  return {
    id: row['id'] as string,
    type: row['type'] as Movement['type'],
    amount: row['amount'] as number,
    description: row['description'] as string,
    category: row['category'] as Movement['category'],
    movementDate: row['movement_date'] as string,
  }
}

// Calcula métricas del dashboard a partir de una lista de movimientos
function calcMetrics(movements: Movement[]): DashboardMetrics {
  let income = 0
  let expenses = 0
  for (const m of movements) {
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ income: 0, expenses: 0, net: 0 })
  const [filter, setFilterState] = useState<DateFilter>('today')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  // Almacena todos los entry IDs del rango actual (para paginación cliente)
  const [allEntryIds, setAllEntryIds] = useState<string[]>([])
  // Todos los movimientos del rango actual (para métricas completas y asociar a entries)
  const [allMovements, setAllMovements] = useState<Movement[]>([])

  const loadData = useCallback(async (f: DateFilter) => {
    setLoading(true)
    setEntries([])
    setHasMore(false)

    const supabase = createClient()
    const { start, end } = getDateRange(f)

    // 1. Cargar todos los movimientos del rango → métricas + asociar a entries
    const { data: movRows } = await supabase
      .from('movements')
      .select('id, entry_id, type, amount, description, category, movement_date')
      .gte('movement_date', start)
      .lte('movement_date', end)
      .order('movement_date', { ascending: false })

    const movements = (movRows ?? []).map(r => toMovement(r as Record<string, unknown>))
    setAllMovements(movements)
    setMetrics(calcMetrics(movements))

    // 2. IDs únicos de entries que tienen movimientos en el rango (orden por primera aparición)
    const seen = new Set<string>()
    const orderedIds: string[] = []
    for (const m of movements) {
      const eid = (m as unknown as { entry_id?: string })['entry_id'] ?? ''
      if (eid && !seen.has(eid)) { seen.add(eid); orderedIds.push(eid) }
    }
    setAllEntryIds(orderedIds)

    // 3. Cargar primera página de entries
    const pageIds = orderedIds.slice(0, PAGE_SIZE)
    if (pageIds.length === 0) {
      setLoading(false)
      return
    }

    const { data: entryRows } = await supabase
      .from('entries')
      .select('id, raw_text, entry_date, created_at, input_source')
      .in('id', pageIds)
      .order('entry_date', { ascending: false })

    const built = buildEntries(entryRows ?? [], movRows ?? [])
    setEntries(built)
    setHasMore(orderedIds.length > PAGE_SIZE)
    setLoading(false)
  }, [])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const supabase = createClient()
    const offset = entries.length
    const pageIds = allEntryIds.slice(offset, offset + PAGE_SIZE)

    if (pageIds.length === 0) { setLoadingMore(false); return }

    const { data: entryRows } = await supabase
      .from('entries')
      .select('id, raw_text, entry_date, created_at, input_source')
      .in('id', pageIds)
      .order('entry_date', { ascending: false })

    const movRows = allMovements as unknown as Record<string, unknown>[]
    const built = buildEntries(entryRows ?? [], movRows)
    setEntries(prev => [...prev, ...built])
    setHasMore(allEntryIds.length > offset + PAGE_SIZE)
    setLoadingMore(false)
  }, [entries.length, allEntryIds, allMovements])

  function setFilter(f: DateFilter) {
    setFilterState(f)
    loadData(f)
  }

  // Añade una nueva entrada al tope de la lista (optimistic update tras confirmar)
  function prependEntry(entry: Entry) {
    setEntries(prev => [entry, ...prev])
    // Recalcular métricas
    const newMovements = [...entry.movements, ...allMovements]
    setAllMovements(newMovements)
    setMetrics(calcMetrics(newMovements))
  }

  return {
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
  }
}

// Helper: combina rows de entries con sus movements
function buildEntries(
  entryRows: Record<string, unknown>[],
  movRows: Record<string, unknown>[]
): Entry[] {
  return entryRows.map(e => ({
    id: e['id'] as string,
    rawText: e['raw_text'] as string,
    entryDate: e['entry_date'] as string,
    createdAt: e['created_at'] as string,
    movements: movRows
      .filter(m => m['entry_id'] === e['id'])
      .map(m => toMovement(m)),
  }))
}
