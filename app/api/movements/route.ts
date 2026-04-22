import { createClient } from '@/lib/supabase/server'
import { calcMetrics, getDateRange } from '@/lib/utils'
import { PLANS } from '@/lib/constants'
import type { DateFilter, TypeFilter, DashboardMetrics } from '@/types'

const PAGE_SIZE = 10

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  // Read plan directly from DB — single source of truth
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free') as 'free' | 'pro'

  // ── Parse query params ────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const filter        = (searchParams.get('filter') ?? 'month') as DateFilter
  const typeFilter    = (searchParams.get('type')   ?? 'all')   as TypeFilter
  const showPendientes  = searchParams.get('showPendientes')  !== 'false'
  const showInvestments = searchParams.get('showInvestments') === 'true'
  const offset   = Math.max(0, parseInt(searchParams.get('offset')   ?? '0', 10))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE), 10))

  // selectedMonth arrives as 'YYYY-MM'; reconstruct as local noon to avoid TZ drift
  const selMonthStr = searchParams.get('selectedMonth') // 'YYYY-MM' or null
  const selectedMonth = selMonthStr
    ? new Date(`${selMonthStr}-01T12:00:00`)
    : undefined

  const fromStr = searchParams.get('from')
  const toStr   = searchParams.get('to')
  const customRange = fromStr && toStr ? { from: fromStr, to: toStr } : undefined

  // ── Server-side plan enforcement ──────────────────────────────────────────

  // 1. Custom date range: Pro only
  if (filter === 'custom' && plan === 'free') {
    return Response.json(
      { error: 'El rango personalizado requiere plan Pro', code: 'PRO_REQUIRED' },
      { status: 403 }
    )
  }

  // 2. History cap: Free users cannot query beyond 30 days
  const maxHistory = plan === 'free' ? PLANS.FREE.historyDays : undefined

  // ── Compute enforced date range ───────────────────────────────────────────
  const { start, end } = getDateRange(filter, selectedMonth, maxHistory, customRange)

  // ── Metrics query (only on first page — no type filter, respects showInvestments)
  let metrics: DashboardMetrics | undefined
  if (offset === 0) {
    const { data: metricsRows } = await supabase
      .from('movements')
      .select('type, amount, is_investment')
      .gte('movement_date', start)
      .lte('movement_date', end)

    metrics = calcMetrics(
      (metricsRows ?? []).map(r => ({
        type: r['type'] as string,
        amount: Number(r['amount']),
        isInvestment: (r['is_investment'] as boolean) ?? false,
      })),
      showInvestments
    )
  }

  // ── Paginated movements query ─────────────────────────────────────────────
  let query = supabase
    .from('movements')
    .select('id, type, amount, description, category, movement_date, is_investment', { count: 'exact' })
    .gte('movement_date', start)
    .lte('movement_date', end)

  if (typeFilter !== 'all') {
    query = query.eq('type', typeFilter) as typeof query
  } else if (!showPendientes) {
    query = query.neq('type', 'pendiente') as typeof query
  }

  const { data: rows, count } = await query
    .order('movement_date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const movements = (rows ?? []).map(r => ({
    id:           r['id']            as string,
    type:         r['type']          as string,
    amount:       Number(r['amount']),
    description:  r['description']   as string,
    category:     r['category']      as string,
    movementDate: r['movement_date'] as string,
    isInvestment: (r['is_investment'] as boolean) ?? false,
  }))

  return Response.json({
    movements,
    total: count ?? 0,
    // enforcedRange lets the client know the actual dates used (useful for UI)
    enforcedRange: { start, end },
    ...(metrics !== undefined && { metrics }),
  })
}
