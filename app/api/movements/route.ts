import { createClient } from '@/lib/supabase/server'
import { calcMetrics, getDateRange } from '@/lib/utils'
import { PLANS } from '@/lib/constants'
import type { DateFilter, TypeFilter, DashboardMetrics } from '@/types'

const PAGE_SIZE = 10

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  // Read plan + include_archived toggle directly from DB — single source of truth
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, include_archived_in_metrics')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free') as 'free' | 'pro'
  const includeArchivedInMetrics = (profile?.include_archived_in_metrics as boolean | null) ?? true

  // ── Parse query params ────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const sort           = searchParams.get('sort') ?? 'date'  // 'date' (default) | 'recent'
  const filter        = (searchParams.get('filter') ?? 'month') as DateFilter
  const typeFilter    = (searchParams.get('type')   ?? 'all')   as TypeFilter
  const showPendientes  = searchParams.get('showPendientes')  !== 'false'
  const showInvestments = searchParams.get('showInvestments') === 'true'
  const offset   = Math.max(0, parseInt(searchParams.get('offset')   ?? '0', 10))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE), 10))

  // Proyectos (v0.5):
  //   ?projectId=<uuid> → solo movs de ese proyecto.
  //   ?projectId=none   → solo movs sin proyecto (overhead general).
  //   ?projectId=all (o no se manda) → todos.
  // Pro-only — Free no debe filtrar por proyecto. Si Free manda el param,
  // lo ignoramos silenciosamente (el flag NO afecta resultados).
  const projectIdParam = searchParams.get('projectId')
  const projectFilter: 'all' | 'none' | string =
    plan === 'pro' && projectIdParam
      ? (projectIdParam === 'none' ? 'none' : projectIdParam === 'all' ? 'all' : projectIdParam)
      : 'all'

  // Si el user tiene el toggle off + es Pro, excluimos movs cuyo project_id
  // apunte a un proyecto archivado. Para Free el toggle no tiene efecto (no
  // tienen proyectos). Necesitamos saber qué proyectos están archivados.
  //
  // Guard: capamos a 100 UUIDs para no construir URLs gigantes vía PostgREST
  // .or(...not.in.(...)). Si el user tiene más archivados, lo dejamos sin
  // filtro (mejor mostrar de más que romper la query). En la práctica un
  // freelancer no llega a >100 archivados en años.
  const ARCHIVED_FILTER_CAP = 100
  let archivedProjectIds: string[] = []
  if (plan === 'pro' && !includeArchivedInMetrics) {
    const { data: arch } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'archived')
      .limit(ARCHIVED_FILTER_CAP + 1)
    const ids = (arch ?? []).map(r => (r as { id: string }).id)
    archivedProjectIds = ids.length > ARCHIVED_FILTER_CAP ? [] : ids
  }

  // ── sort=recent: lista de los más recientes por created_at ───────────────
  //
  // Pensado para el card "Últimos movimientos" de /registros, donde el user
  // verifica visualmente que lo que acaba de registrar se guardó. Diferente
  // del default (sort='date' = order by movement_date), que está pensado para
  // explorar el historial por fecha real del movimiento.
  //
  // - Ignora filter/selectedMonth/from/to/showInvestments/showPendientes —
  //   queremos ver TODO lo registrado recientemente, sin filtros.
  // - Ignora el cap de 30 días de Free (lo que importa es "lo último que
  //   registré", no "qué pasó en este período"). Free no abusa porque solo
  //   pide N filas.
  // - Sin métricas — esto NO es un período, no tiene sentido sumar.
  if (sort === 'recent') {
    let q = supabase
      .from('movements')
      .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type, created_at, project_id')
      .eq('user_id', user.id)

    // Filtro de proyecto en 'recent' también (útil para ver "lo último de este
    // proyecto"). Para Free es no-op (projectFilter='all').
    if (projectFilter === 'none') {
      q = q.is('project_id', null) as typeof q
    } else if (projectFilter !== 'all') {
      q = q.eq('project_id', projectFilter) as typeof q
    } else if (archivedProjectIds.length > 0) {
      // Excluir movs de archivados cuando el toggle está off.
      q = q.or(
        `project_id.is.null,project_id.not.in.(${archivedProjectIds.join(',')})`,
      ) as typeof q
    }

    const { data: rows } = await q
      .order('created_at', { ascending: false })
      .order('id',         { ascending: false })  // tie-break determinista
      .range(offset, offset + pageSize - 1)

    const movements = (rows ?? []).map(r => ({
      id:           r['id']            as string,
      type:         r['type']          as string,
      amount:       Number(r['amount']),
      description:  r['description']   as string,
      category:     r['category']      as string,
      movementDate: r['movement_date'] as string,
      isInvestment: (r['is_investment'] as boolean) ?? false,
      paidAt:       (r['paid_at']       as string | null) ?? null,
      originalType: (r['original_type'] as string | null) ?? null,
      projectId:    (r['project_id']    as string | null) ?? null,
    }))

    return Response.json({ movements, sort: 'recent' })
  }

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
    let mq = supabase
      .from('movements')
      .select('type, amount, is_investment, project_id')
      .gte('movement_date', start)
      .lte('movement_date', end)

    // Mismos filtros de proyecto/archivados que la lista paginada — sin esto
    // los cards de /inicio mostrarían un total distinto al de la lista.
    if (projectFilter === 'none') {
      mq = mq.is('project_id', null) as typeof mq
    } else if (projectFilter !== 'all') {
      mq = mq.eq('project_id', projectFilter) as typeof mq
    } else if (archivedProjectIds.length > 0) {
      mq = mq.or(
        `project_id.is.null,project_id.not.in.(${archivedProjectIds.join(',')})`,
      ) as typeof mq
    }

    const { data: metricsRows } = await mq

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
    .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type, project_id', { count: 'exact' })
    .gte('movement_date', start)
    .lte('movement_date', end)

  if (typeFilter !== 'all') {
    query = query.eq('type', typeFilter) as typeof query
  } else if (!showPendientes) {
    query = query.neq('type', 'pendiente') as typeof query
  }

  if (projectFilter === 'none') {
    query = query.is('project_id', null) as typeof query
  } else if (projectFilter !== 'all') {
    query = query.eq('project_id', projectFilter) as typeof query
  } else if (archivedProjectIds.length > 0) {
    query = query.or(
      `project_id.is.null,project_id.not.in.(${archivedProjectIds.join(',')})`,
    ) as typeof query
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
    paidAt:       (r['paid_at']       as string | null) ?? null,
    originalType: (r['original_type'] as string | null) ?? null,
    projectId:    (r['project_id']    as string | null) ?? null,
  }))

  return Response.json({
    movements,
    total: count ?? 0,
    // enforcedRange lets the client know the actual dates used (useful for UI)
    enforcedRange: { start, end },
    ...(metrics !== undefined && { metrics }),
  })
}
