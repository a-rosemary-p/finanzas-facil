'use client'

/**
 * Hook para el tab Recurrentes en /pendientes.
 *
 * CRUD vía /api/recurring (server-side) — no usamos el cliente Supabase
 * directo porque la lógica de "materializar primer pendiente al crear" vive
 * server-side.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { RecurringMovement, RecurringFrequency } from '@/types'

export function useRecurring() {
  const [recurring, setRecurring] = useState<RecurringMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuthRetry('/api/recurring')
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        setError(body?.error ?? `Error ${res.status}`)
        setRecurring([])
        return
      }
      const data = await res.json() as { recurring?: RecurringMovement[] }
      setRecurring(data.recurring ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setRecurring([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const update = useCallback(async (
    id: string,
    patch: Partial<{
      type: 'ingreso' | 'gasto'
      amount: number
      description: string
      category: string
      frequency: RecurringFrequency
      nextDueDate: string
      isActive: boolean
    }>,
  ) => {
    const prev = recurring
    setRecurring(rs => rs.map(r => r.id === id ? { ...r, ...patch } as RecurringMovement : r))
    try {
      const res = await fetchWithAuthRetry(`/api/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        setRecurring(prev)
        return false
      }
      // Reload para que `nextDueDate` y `is_active` reflejen lo que hizo el
      // server (ej. si pausamos+reanudamos puede haber materializado).
      await load()
      return true
    } catch {
      setRecurring(prev)
      return false
    }
  }, [recurring, load])

  const remove = useCallback(async (id: string) => {
    const prev = recurring
    setRecurring(rs => rs.filter(r => r.id !== id))
    try {
      const res = await fetchWithAuthRetry(`/api/recurring/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setRecurring(prev)
        return false
      }
      return true
    } catch {
      setRecurring(prev)
      return false
    }
  }, [recurring])

  return { recurring, loading, error, refresh: load, update, remove }
}
