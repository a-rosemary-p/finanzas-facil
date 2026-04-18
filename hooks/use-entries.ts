'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDateRange } from '@/lib/utils'
import type { Entry, Movement, DateFilter, DashboardMetrics } from '@/types'

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

function calcMetrics(movements: Movement[]): DashboardMetrics {
  let income = 0
  let expenses = 0
  for (const m of movements) {
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

// Construye Entry[] preservando el orden de entryIds (que viene de movement_date DESC)
function buildEntriesOrdered(
  ids: string[],
  entryRows: Record<string, unknown>[],
  movRows: Record<string, unknown>[]
): Entry[] {
  const byId = new Map(entryRows.map(e => [e['id'] as string, e]))
  return ids
    .filter(id => byId.has(id))
    .map(id => {
      const e = byId.get(id)!
      return {
        id: e['id'] as string,
        rawText: e['raw_text'] as string,
        entryDate: e['entry_date'] as string,
        createdAt: e['created_at'] as string,
        movements: movRows
          .filter(m => m['entry_id'] === id)
          .map(m => toMovement(m)),
      }
    })
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ income: 0, expenses: 0, net: 0 })
  const [filter, setFilterState] = useState<DateFilter>('today')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [allEntryIds, setAllEntryIds] = useState<string[]>([])
  const [allMovRows, setAllMovRows] = useState<Record<string, unknown>[]>([])

  const loadData = useCallback(async (f: DateFilter) => {
    setLoading(true)
    setEntries([])
    setHasMore(false)

    const supabase = createClient()
    const { start, end } = getDateRange(f)

    // 1. Todos los movimientos del rango → métricas
    const { data: movRows } = await supabase
      .from('movements')
      .select('id, entry_id, type, amount, description, category, movement_date')
      .gte('movement_date', start)
      .lte('movement_date', end)
      .order('movement_date', { ascending: false })

    const rows = movRows ?? []
    setAllMovRows(rows)
    const movements = rows.map(r => toMovement(r as Record<string, unknown>))
    setMetrics(calcMetrics(movements))

    // 2. IDs únicos de entries en el orden de movement_date DESC
    const seen = new Set<string>()
    const orderedIds: string[] = []
    for (const m of rows) {
      const eid = (m as Record<string, unknown>)['entry_id'] as string
      if (eid && !seen.has(eid)) { seen.add(eid); orderedIds.push(eid) }
    }
    setAllEntryIds(orderedIds)

    if (orderedIds.length === 0) { setLoading(false); return }

    // 3. Primera página de entries (sin re-ordenar en Supabase — el orden lo manejamos nosotros)
    const pageIds = orderedIds.slice(0, PAGE_SIZE)
    const { data: entryRows } = await supabase
      .from('entries')
      .select('id, raw_text, entry_date, created_at')
      .in('id', pageIds)

    const built = buildEntriesOrdered(pageIds, entryRows ?? [], rows)
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
      .select('id, raw_text, entry_date, created_at')
      .in('id', pageIds)

    const built = buildEntriesOrdered(pageIds, entryRows ?? [], allMovRows)
    setEntries(prev => [...prev, ...built])
    setHasMore(allEntryIds.length > offset + PAGE_SIZE)
    setLoadingMore(false)
  }, [entries.length, allEntryIds, allMovRows])

  function setFilter(f: DateFilter) {
    setFilterState(f)
    loadData(f)
  }

  function prependEntry(entry: Entry) {
    setEntries(prev => [entry, ...prev])
    // Recalcular métricas con los nuevos movimientos
    const newRows = [
      ...entry.movements.map(m => ({
        id: m.id, entry_id: entry.id,
        type: m.type, amount: m.amount,
        description: m.description, category: m.category,
        movement_date: m.movementDate,
      })),
      ...allMovRows,
    ]
    setAllMovRows(newRows)
    setMetrics(calcMetrics(newRows.map(r => toMovement(r as Record<string, unknown>))))
    setAllEntryIds(prev => [entry.id, ...prev])
  }

  return {
    entries, metrics, filter, setFilter,
    loadData, loadMore, loading, loadingMore, hasMore, prependEntry,
  }
}
