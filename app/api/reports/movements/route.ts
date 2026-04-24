/**
 * app/api/reports/movements/route.ts
 *
 * Devuelve los movimientos de un mes específico para la pantalla /reportes.
 *
 * Antes, /reportes hacía el query directo al Supabase client desde el browser —
 * lo cual permitía a un usuario Free bajar reportes de meses de hace años,
 * saltándose el cap de 30 días del plan Free que sí se enforça en /dashboard
 * vía /api/movements.
 *
 * Esta ruta aplica el mismo cap server-side: para plan Free, el rango efectivo
 * es la intersección del mes pedido con los últimos 30 días. Pro ve el mes
 * completo siempre.
 */

import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/constants'
import type { Movement } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free') as 'free' | 'pro'

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'Mes inválido (usa YYYY-MM)' }, { status: 400 })
  }

  // Rango del mes solicitado
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const monthEnd   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Aplica el cap del plan Free: recorta el inicio del rango al máximo
  // (hoy - historyDays) si el mes pedido está parcial/completamente fuera.
  let effectiveStart = monthStart
  let truncated = false
  if (plan === 'free') {
    const today = new Date()
    const capDate = new Date(today)
    capDate.setDate(capDate.getDate() - PLANS.FREE.historyDays)
    const capStr = capDate.toISOString().slice(0, 10)

    if (capStr > monthEnd) {
      // El mes completo está antes del cap → vacío y flag "truncated"
      return Response.json({
        movements: [],
        enforcedRange: { start: monthStart, end: monthEnd },
        truncated: true,
      })
    }

    if (capStr > monthStart) {
      effectiveStart = capStr
      truncated = true
    }
  }

  const { data, error } = await supabase
    .from('movements')
    .select('id, type, amount, description, category, movement_date, is_investment')
    .gte('movement_date', effectiveStart)
    .lte('movement_date', monthEnd)
    .eq('user_id', user.id)  // defense-in-depth sobre RLS
    .order('movement_date', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    console.error('[GET /api/reports/movements]', error)
    return Response.json({ error: 'Error al cargar movimientos' }, { status: 500 })
  }

  const movements: Movement[] = (data ?? []).map(r => ({
    id: r.id as string,
    type: r.type as Movement['type'],
    amount: Number(r.amount),
    description: r.description as string,
    category: r.category as Movement['category'],
    movementDate: r.movement_date as string,
    isInvestment: (r.is_investment as boolean) ?? false,
  }))

  return Response.json({
    movements,
    enforcedRange: { start: effectiveStart, end: monthEnd },
    truncated,
  })
}
