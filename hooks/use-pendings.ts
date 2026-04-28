'use client'

/**
 * Hook focalizado para la página /pendientes y el banner notification dot.
 *
 * Antes vivía mezclado en `useEntries` (que maneja TODO: filtros de período,
 * paginación, métricas, etc.). Después del rediseño v0.27 useEntries quedó
 * semi-orphaned y solo `loadPendings` + `markAsPaid` siguen siendo útiles —
 * los extraemos aquí para que la página /pendientes no traiga toda la
 * maquinaria de paginación/filtros que no usa.
 *
 * Acceso a Supabase: directo desde el cliente (no API route) porque pendientes
 * no tienen enforcement de plan. RLS hace el filtro por user_id.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Movement } from '@/types'

export function usePendings() {
  const [pendings, setPendings] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('movements')
        .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type')
        .eq('type', 'pendiente')
        .order('movement_date', { ascending: true })

      if (err) {
        setError(err.message)
        setPendings([])
      } else {
        setPendings(
          (data ?? []).map(r => ({
            id: r.id as string,
            type: r.type as Movement['type'],
            amount: Number(r.amount),
            description: r.description as string,
            category: r.category as Movement['category'],
            movementDate: r.movement_date as string,
            isInvestment: (r.is_investment as boolean) ?? false,
            paidAt: (r.paid_at as string | null) ?? null,
            originalType: (r.original_type as Movement['type'] | null) ?? null,
          }))
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setPendings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Marca un pendiente como pagado: cambia type a 'gasto' y settea
  // movement_date=hoy para que aparezca en el período actual. El audit trail
  // (insertar evento en movement_events) lo hace el endpoint PATCH server-side.
  const markAsPaid = useCallback(async (id: string) => {
    const today = new Date()
    const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Optimistic remove de la lista visible — vuelve a aparecer si el PATCH falla.
    const prev = pendings
    setPendings(p => p.filter(m => m.id !== id))

    try {
      const res = await fetch(`/api/movements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gasto', movementDate: todayYMD }),
      })
      if (!res.ok) {
        setPendings(prev) // rollback
        return false
      }
      return true
    } catch {
      setPendings(prev)
      return false
    }
  }, [pendings])

  // Edita campos de un pendiente. Misma API que /api/movements/[id] PATCH.
  const updatePending = useCallback(async (
    id: string,
    patch: Partial<Pick<Movement, 'type' | 'amount' | 'description' | 'category' | 'movementDate' | 'isInvestment'>>
  ) => {
    const prev = pendings
    setPendings(p => p.map(m => (m.id === id ? { ...m, ...patch } : m)))

    try {
      const res = await fetch(`/api/movements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        setPendings(prev)
        return false
      }
      // Si cambió a tipo distinto de 'pendiente', removemos de la lista.
      if (patch.type && patch.type !== 'pendiente') {
        setPendings(p => p.filter(m => m.id !== id))
      }
      return true
    } catch {
      setPendings(prev)
      return false
    }
  }, [pendings])

  const deletePending = useCallback(async (id: string) => {
    const prev = pendings
    setPendings(p => p.filter(m => m.id !== id))

    try {
      const res = await fetch(`/api/movements/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setPendings(prev)
        return false
      }
      return true
    } catch {
      setPendings(prev)
      return false
    }
  }, [pendings])

  // ── Helpers derivados ───────────────────────────────────────────────────
  const today = new Date()
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // "Vencido" = movement_date <= hoy. Inclusivo: si vence hoy ya cuenta.
  const overdue = pendings.filter(p => p.movementDate <= todayYMD)
  const upcoming = pendings.filter(p => p.movementDate > todayYMD)

  return {
    pendings,
    overdue,
    upcoming,
    overdueCount: overdue.length,
    loading,
    error,
    refresh: load,
    markAsPaid,
    updatePending,
    deletePending,
  }
}
