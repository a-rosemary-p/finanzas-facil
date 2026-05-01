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
import { track } from '@/lib/analytics'
import { getAppToday } from '@/lib/cdmx-date'
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
      // Trackeo: necesitamos saber si se pagó tarde, en fecha o por adelantado.
      // `target.movementDate` es la fecha de vencimiento. Si <= hoy → vencido o
      // de hoy mismo. days_until_due > 0 = adelantado, < 0 = atrasado.
      if (target) {
        const today = getAppToday()
        const dueMs = new Date(target.movementDate + 'T00:00:00').getTime()
        const todayMs = new Date(today + 'T00:00:00').getTime()
        const daysUntilDue = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24))
        track('pending_paid', {
          direction: targetType,
          category: target.category,
          days_until_due: daysUntilDue,
          was_overdue: daysUntilDue < 0,
        })
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
  // "Hoy" en CDMX (consistente con todo el resto de la app).
  const todayYMD = getAppToday()

  // "Vencido" = movement_date < hoy (estrictamente). Los de HOY entran en
  // upcoming para que aparezcan en el tope de la lista de próximos.
  const overdue  = pendings.filter(p => p.movementDate <  todayYMD)
  const upcoming = pendings.filter(p => p.movementDate >= todayYMD)

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
