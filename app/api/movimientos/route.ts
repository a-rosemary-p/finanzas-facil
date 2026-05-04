/**
 * GET /api/movimientos (v0.29 — pensado para la nueva página /movimientos)
 *
 * Lista paginada de movimientos con filtros de fecha + categoría multi-select.
 * Diferente del clásico /api/movements:
 *   - Acepta `categories` (comma-separated) en vez de `type` singular
 *   - 5 categorías UI-level: ingresos / gastos / inversiones / pendientes / recurrentes
 *     (mapean a combinaciones de columnas type, is_investment, recurring_movement_id)
 *   - OR lógico entre categorías seleccionadas
 *   - Sin métricas (la página no las muestra)
 *
 * Plan enforcement:
 *   - Free: history capado a 30 días, no acepta filter=custom o filter=year
 *   - Pro: sin cap, todos los filtros
 *
 * Query params:
 *   filter      = today | 7days | month | year | custom (default 'month')
 *   from, to    = YYYY-MM-DD (solo si filter=custom)
 *   categories  = ingresos,gastos,inversiones,pendientes,recurrentes (default: todas)
 *   offset      = number (default 0)
 *   pageSize    = number (default 30, max 100)
 *
 * Respuesta: { movements: Movement[], total, enforcedRange: { start, end } }
 */

import { createClient } from '@/lib/supabase/server'
import { getDateRange } from '@/lib/utils'
import { PLANS } from '@/lib/constants'
import type { DateFilter } from '@/types'

const ALL_CATEGORIES = ['ingresos', 'gastos', 'inversiones', 'pendientes', 'recurrentes'] as const
type Category = (typeof ALL_CATEGORIES)[number]

const DEFAULT_PAGE_SIZE = 30
const MAX_PAGE_SIZE = 100

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
  const filter = (searchParams.get('filter') ?? 'month') as DateFilter
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const pageSize = Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10))

  // Categorías: parse comma-separated, validar contra whitelist, default = todas
  const catsRaw = searchParams.get('categories')
  const categories: Category[] = catsRaw
    ? catsRaw.split(',').map(s => s.trim()).filter((s): s is Category => (ALL_CATEGORIES as readonly string[]).includes(s))
    : [...ALL_CATEGORIES]

  if (categories.length === 0) {
    // Si pasaron categories= con valores inválidos, devolvemos lista vacía en vez
    // de aplicar default — el cliente quería filtrar y filtró a nada.
    return Response.json({
      movements: [],
      total: 0,
      enforcedRange: { start: '', end: '' },
    })
  }

  // ── Plan enforcement ────────────────────────────────────────────────────────
  if (plan === 'free') {
    if (filter === 'custom') {
      return Response.json({ error: 'El rango personalizado requiere plan Pro', code: 'PRO_REQUIRED' }, { status: 403 })
    }
    if (filter === 'year') {
      return Response.json({ error: 'El filtro de año requiere plan Pro', code: 'PRO_REQUIRED' }, { status: 403 })
    }
  }

  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')
  const customRange = fromStr && toStr ? { from: fromStr, to: toStr } : undefined
  const maxHistory = plan === 'free' ? PLANS.FREE.historyDays : undefined

  const { start, end } = getDateRange(filter, undefined, maxHistory, customRange)

  // ── Construir el filtro OR de categorías ───────────────────────────────────
  // Cada categoría es una condición sobre las columnas. El OR de PostgREST
  // se hace con `.or('cond1,cond2,...')`. La sintaxis usa comas y no escape,
  // así que componemos con cuidado.
  //
  // Mapeo:
  //   ingresos    → type=eq.ingreso AND is_investment=eq.false
  //   gastos      → type=eq.gasto AND is_investment=eq.false
  //   inversiones → is_investment=eq.true
  //   pendientes  → type=eq.pendiente
  //   recurrentes → recurring_movement_id=not.is.null
  //
  // PostgREST `.or()` no soporta AND dentro fácilmente — para "ingresos
  // no-inversión" hay que filtrar en memoria post-fetch O usar dos rondas.
  // Para mantener simple y correcto el OR, pedimos un superset y filtramos
  // client-side dentro del server (en JS post-fetch). El superset es:
  // type ∈ {tipos seleccionados} ∪ inversiones ∪ recurrentes.

  // Construir el SELECT base
  let query = supabase
    .from('movements')
    .select(
      'id, type, amount, description, category, movement_date, is_investment, paid_at, original_type, pending_direction, recurring_movement_id',
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .gte('movement_date', start)
    .lte('movement_date', end)

  // Optimización: si NO hay inversiones y NO hay recurrentes en el filter,
  // podemos hacer un .in('type', [...]) directo. Esto cubre el caso común
  // (ingresos/gastos/pendientes seleccionados).
  const hasInvestments = categories.includes('inversiones')
  const hasRecurrentes = categories.includes('recurrentes')

  if (!hasInvestments && !hasRecurrentes) {
    const types: string[] = []
    if (categories.includes('ingresos'))   types.push('ingreso')
    if (categories.includes('gastos'))     types.push('gasto')
    if (categories.includes('pendientes')) types.push('pendiente')
    query = query.in('type', types) as typeof query
  }
  // Si SÍ hay inversiones o recurrentes en el filter, traemos un superset y
  // filtramos en memoria abajo. Tradeoff: páginas pueden venir con menos rows
  // de las pedidas. Para fix correcto necesitaríamos una vista materializada
  // o filter en SQL más complejo — para volumen actual es aceptable.

  const { data: rows, count, error } = await query
    .order('movement_date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error('[GET /api/movimientos]', error)
    return Response.json({ error: 'Error al cargar movimientos' }, { status: 500 })
  }

  // Filtrar in-memory cuando categorías especiales (inversiones/recurrentes) están activas
  const filtered = (rows ?? []).filter(r => {
    const type = r['type'] as string
    const isInvestment = (r['is_investment'] as boolean) ?? false
    const hasRecurringId = r['recurring_movement_id'] != null

    // OR lógico entre categorías seleccionadas
    return categories.some(cat => {
      switch (cat) {
        case 'ingresos':    return type === 'ingreso' && !isInvestment
        case 'gastos':      return type === 'gasto'   && !isInvestment
        case 'inversiones': return isInvestment
        case 'pendientes':  return type === 'pendiente'
        case 'recurrentes': return hasRecurringId
      }
    })
  })

  const movements = filtered.map(r => ({
    id:                  r['id']                    as string,
    type:                r['type']                  as string,
    amount:              Number(r['amount']),
    description:         r['description']           as string,
    category:            r['category']              as string,
    movementDate:        r['movement_date']         as string,
    isInvestment:        (r['is_investment']        as boolean) ?? false,
    paidAt:              (r['paid_at']              as string | null) ?? null,
    originalType:        (r['original_type']        as string | null) ?? null,
    pendingDirection:    (r['pending_direction']    as 'ingreso' | 'gasto' | null) ?? null,
    recurringMovementId: (r['recurring_movement_id'] as string | null) ?? null,
  }))

  return Response.json({
    movements,
    total: count ?? 0,
    enforcedRange: { start, end },
  })
}
