/**
 * GET /api/reports/projects-ranking (v0.63 — Pro only)
 *
 * Devuelve el ranking de proyectos del período seleccionado por net descending.
 * Alimenta la sección "Top proyectos" en /reportes "Este período".
 *
 * Solo cuenta movs con type ingreso|gasto (pendientes no), excluyendo
 * inversiones (consistente con el resto de /reportes).
 *
 * Solo proyectos que tuvieron movs en el período aparecen. Cap a 8 resultados
 * para que la sección no se haga muy larga.
 *
 * Query params:
 *   mode    = week | month | quarter | year
 *   anchor  = YYYY-MM-DD
 */

import { createClient } from '@/lib/supabase/server'
import {
  periodRange,
  type PeriodMode,
  type PeriodSelection,
} from '@/lib/periods'

const VALID_MODES: PeriodMode[] = ['week', 'month', 'quarter', 'year']
const MAX_RESULTS = 8

interface RankingItem {
  projectId: string
  projectName: string
  projectClient: string | null
  projectStatus: 'active' | 'archived'
  income: number
  expenses: number
  net: number
  marginPct: number | null
  movementCount: number
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  // Gate Pro: el ranking es feature Pro.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  if ((profile?.plan as string) !== 'pro') {
    return Response.json(
      { error: 'El ranking de proyectos es una funcionalidad Pro.', code: 'PRO_REQUIRED' },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const modeRaw = searchParams.get('mode')
  const anchorRaw = searchParams.get('anchor')

  if (!modeRaw || !VALID_MODES.includes(modeRaw as PeriodMode)) {
    return Response.json({ error: 'mode inválido (week|month|quarter|year)' }, { status: 400 })
  }
  if (!anchorRaw || !/^\d{4}-\d{2}-\d{2}$/.test(anchorRaw)) {
    return Response.json({ error: 'anchor inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const period: PeriodSelection = { mode: modeRaw as PeriodMode, anchor: anchorRaw }
  const range = periodRange(period)

  // Una query: todos los movs del rango con project_id no-null.
  const { data: rows, error } = await supabase
    .from('movements')
    .select('type, amount, project_id, is_investment')
    .eq('user_id', user.id)
    .in('type', ['ingreso', 'gasto'])
    .not('project_id', 'is', null)
    .gte('movement_date', range.start)
    .lte('movement_date', range.end)

  if (error) {
    console.error('[GET /api/reports/projects-ranking] movs', error)
    return Response.json({ error: 'Error al cargar movimientos' }, { status: 500 })
  }

  // Agregar por proyecto (excluyendo inversiones — mismo criterio que el resto de /reportes).
  const agg = new Map<string, { income: number; expenses: number; count: number }>()
  for (const r of rows ?? []) {
    const row = r as { type: string; amount: number | string; project_id: string; is_investment: boolean | null }
    if (row.is_investment) continue
    const pid = row.project_id
    const amt = Number(row.amount) || 0
    let cur = agg.get(pid)
    if (!cur) {
      cur = { income: 0, expenses: 0, count: 0 }
      agg.set(pid, cur)
    }
    if (row.type === 'ingreso') cur.income += amt
    else if (row.type === 'gasto') cur.expenses += amt
    cur.count += 1
  }

  if (agg.size === 0) {
    return Response.json({ ranking: [], range })
  }

  // Lookup de nombre + cliente + status para los proyectos relevantes.
  const projectIds = Array.from(agg.keys())
  const { data: projRows } = await supabase
    .from('projects')
    .select('id, name, client_name, status')
    .eq('user_id', user.id)
    .in('id', projectIds)

  const projMap = new Map<string, { name: string; clientName: string | null; status: 'active' | 'archived' }>()
  for (const p of projRows ?? []) {
    const row = p as { id: string; name: string; client_name: string | null; status: string }
    projMap.set(row.id, {
      name: row.name,
      clientName: row.client_name,
      status: row.status === 'archived' ? 'archived' : 'active',
    })
  }

  const ranking: RankingItem[] = []
  for (const [pid, totals] of agg.entries()) {
    const proj = projMap.get(pid)
    if (!proj) continue // proyecto eliminado entre query y lookup — skip
    const net = totals.income - totals.expenses
    ranking.push({
      projectId: pid,
      projectName: proj.name,
      projectClient: proj.clientName,
      projectStatus: proj.status,
      income: totals.income,
      expenses: totals.expenses,
      net,
      marginPct: totals.income > 0 ? net / totals.income : null,
      movementCount: totals.count,
    })
  }

  // Sort por net descending. Pérdidas (net < 0) van al final.
  ranking.sort((a, b) => b.net - a.net)

  return Response.json({
    ranking: ranking.slice(0, MAX_RESULTS),
    range,
  })
}
