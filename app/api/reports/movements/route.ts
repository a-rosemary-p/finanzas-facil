/**
 * app/api/reports/movements/route.ts
 *
 * Devuelve los movimientos en un rango de fechas para la pantalla /reportes.
 * Soporta dos formas de pedir:
 *
 *   GET ?month=YYYY-MM            → devuelve el mes calendario (back-compat)
 *   GET ?from=YYYY-MM-DD&to=...   → devuelve cualquier rango (Pro)
 *
 * Para Free, el rango efectivo está capped a "mes actual + 2 anteriores"
 * (PLANS.FREE.historyMonths = 3). Si Free pide algo fuera de ese cap o usa
 * from+to → 403 PRO_REQUIRED. Pro puede pedir cualquier rango razonable.
 */

import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/constants'
import type { Movement } from '@/types'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-\d{2}$/

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
  const month = searchParams.get('month')
  const from  = searchParams.get('from')
  const to    = searchParams.get('to')

  let rangeStart: string
  let rangeEnd: string

  // ── Path A: from + to (Pro) ─────────────────────────────────────────────
  if (from && to) {
    if (plan === 'free') {
      return Response.json(
        { error: 'Rangos personalizados son una función Pro', code: 'PRO_REQUIRED' },
        { status: 403 }
      )
    }
    if (!YMD.test(from) || !YMD.test(to)) {
      return Response.json({ error: 'from/to inválidos (YYYY-MM-DD)' }, { status: 400 })
    }
    if (from > to) {
      return Response.json({ error: 'from debe ser ≤ to' }, { status: 400 })
    }
    // Sanity cap: máximo 13 meses para evitar queries gigantes accidentales
    const span = Date.parse(to + 'T12:00:00') - Date.parse(from + 'T12:00:00')
    if (span > 1000 * 60 * 60 * 24 * 400) {
      return Response.json({ error: 'Rango demasiado amplio (máx ~13 meses)' }, { status: 400 })
    }
    rangeStart = from
    rangeEnd = to
  }
  // ── Path B: month (back-compat, Free + Pro) ──────────────────────────────
  else if (month) {
    if (!YM.test(month)) {
      return Response.json({ error: 'Mes inválido (YYYY-MM)' }, { status: 400 })
    }
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const monthEnd   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Cap Free: mes actual + 2 anteriores
    if (plan === 'free') {
      const today = new Date()
      const earliest = new Date(today.getFullYear(), today.getMonth() - (PLANS.FREE.historyMonths - 1), 1)
      const earliestKey  = earliest.getFullYear() * 12 + earliest.getMonth()
      const requestedKey = y * 12 + (m - 1)
      if (requestedKey < earliestKey) {
        return Response.json({
          movements: [],
          enforcedRange: { start: monthStart, end: monthEnd },
          truncated: true,
          blocked: true,
        })
      }
    }

    rangeStart = monthStart
    rangeEnd = monthEnd
  }
  else {
    return Response.json({ error: 'Falta month o from+to' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('movements')
    .select('id, type, amount, description, category, movement_date, is_investment')
    .gte('movement_date', rangeStart)
    .lte('movement_date', rangeEnd)
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
    enforcedRange: { start: rangeStart, end: rangeEnd },
    truncated: false,
    blocked: false,
  })
}
