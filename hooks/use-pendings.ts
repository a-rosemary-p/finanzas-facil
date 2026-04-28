'use client'

/**
 * Hook focalizado para la página /pendientes y el banner notification dot.
 *
 * Acceso a Supabase: SELECT directo desde el cliente (no via API route)
 * porque listar pendientes no tiene enforcement de plan; RLS hace el filtro
 * por user_id. Las mutaciones (markAsPaid / updatePending / deletePending)
 * sí van por /api/movements/[id] PATCH/DELETE para que el server registre
 * audit events y dispare la materialización del siguiente recurrente cuando
 * aplica.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
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
        .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type, pending_direction, recurring_movement_id')
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
            pendingDirection: (r.pending_direction as 'ingreso' | 'gasto' | null) ?? null,
            recurringMovementId: (r.recurring_movement_id as string | null) ?? null,
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

  // Marca un pendiente como pagado. El tipo destino depende de
  // `pendingDirection` (si está presente). Para back-compat, si no hay
  // dirección asume gasto.
  // movement_date queda con la fecha original (cuándo era el compromiso) —
  // el server marca paid_at = NOW() para el audit trail. Si el user quiere
  // cambiar la fecha de "cuando se pagó", lo hace en modo edit.
  const markAsPaid = useCallback(async (id: string) => {
    // Encontramos el pending para leer su dirección antes de optimistic remove.
    const target = pendings.find(p => p.id === id)
    const targetType: 'ingreso' | 'gasto' =
      target?.pendingDirection === 'ingreso' ? 'ingreso' : 'gasto'

    const prev = pendings
    setPendings(p => p.filter(m => m.id !== id))

    try {
      const res = await fetchWithAuthRetry(`/api/movements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: targetType }),
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
      const res = await fetchWithAuthRetry(`/api/movements/${id}`, {
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
      const res = await fetchWithAuthRetry(`/api/movements/${id}`, { method: 'DELETE' })
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
