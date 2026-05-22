/**
 * Helpers server-side del feature Proyectos (v0.5).
 *
 * - Map DB row → Project type (snake_case → camelCase + nullish defaults).
 * - assertProAndGetProfile: gate común para todos los endpoints /api/projects/*.
 * - computeSummariesFromMovements: agrega income/expenses/net/margin/lastActivity
 *   por proyecto a partir de un set de filas de movements ya filtradas.
 * - MAX_ACTIVE_PROJECTS: constante alineada al trigger DB (defense-in-depth).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project, ProjectSummary, ProjectStatus } from '@/types'

export const MAX_ACTIVE_PROJECTS = 10
export const MAX_NAME_LEN = 60
export const MAX_CLIENT_LEN = 60
export const MAX_NOTES_LEN = 2000

export interface ProjectDbRow {
  id: string
  user_id: string
  name: string
  client_name: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

/** snake_case → camelCase, con narrow del status string al union. */
export function mapDbProject(row: ProjectDbRow): Project {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    status: (row.status === 'archived' ? 'archived' : 'active') as ProjectStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  }
}

/**
 * Verifica auth + plan Pro. Devuelve user + profile fields para que el handler
 * los reuse sin re-querying. Devuelve null + Response listo si falla.
 */
export async function assertProAndGetProfile(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; userId: string; plan: 'pro' }
  | { ok: false; response: Response }
> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  if ((profile?.plan as string) !== 'pro') {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'Proyectos es una funcionalidad Pro.',
          code: 'PRO_REQUIRED',
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: user.id, plan: 'pro' }
}

/** Cuenta proyectos activos del user — para validación previa al insert/reopen. */
export async function countActiveProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
  return count ?? 0
}

/** Fila de movimientos relevante para agregaciones de proyecto. */
export interface MovementAggInput {
  project_id: string | null
  type: 'ingreso' | 'gasto' | 'pendiente'
  amount: number | string
  movement_date: string
  is_investment: boolean | null
}

/**
 * Agrega un set de movements en summaries por project_id. Reglas:
 *
 * - Solo cuentan type='ingreso' y type='gasto' (pendientes no — aún no es real).
 * - Inversiones (is_investment=true) cuentan como gasto normal del proyecto;
 *   el toggle "mostrar inversiones" del user no aplica aquí porque la métrica
 *   del proyecto es rentabilidad cruda, no flujo de operación.
 * - lastActivityAt: la fecha del movimiento más reciente del proyecto.
 *   El caller debe fusionar con projects.updated_at si quiere "última actividad
 *   tomando en cuenta renombrados también" — esta función solo ve movs.
 */
export function aggregateProjectSummaries(
  movements: MovementAggInput[],
): Map<string, ProjectSummary> {
  const out = new Map<string, ProjectSummary>()

  for (const m of movements) {
    if (!m.project_id) continue
    if (m.type === 'pendiente') continue

    const key = m.project_id
    const amt = Number(m.amount) || 0

    let s = out.get(key)
    if (!s) {
      s = {
        projectId: key,
        income: 0,
        expenses: 0,
        net: 0,
        marginPct: null,
        movementCount: 0,
        lastActivityAt: null,
      }
      out.set(key, s)
    }

    if (m.type === 'ingreso') s.income += amt
    else s.expenses += amt
    s.movementCount += 1

    if (!s.lastActivityAt || m.movement_date > s.lastActivityAt) {
      s.lastActivityAt = m.movement_date
    }
  }

  for (const s of out.values()) {
    s.net = s.income - s.expenses
    s.marginPct = s.income > 0 ? s.net / s.income : null
  }

  return out
}

/** Summary vacío para proyectos sin movimientos todavía. */
export function emptySummary(projectId: string): ProjectSummary {
  return {
    projectId,
    income: 0,
    expenses: 0,
    net: 0,
    marginPct: null,
    movementCount: 0,
    lastActivityAt: null,
  }
}

/**
 * Bucketing de movimientos por mes o semana para chart de detalle.
 *
 * Si el rango total del proyecto (min→max movement_date) ≤ 60 días → semana.
 * Si > 60 días → mes.
 */
export function bucketByMonthOrWeek(
  movements: MovementAggInput[],
): { granularity: 'week' | 'month'; points: Array<{ bucketStart: string; income: number; expenses: number; net: number }> } {
  if (movements.length === 0) {
    return { granularity: 'month', points: [] }
  }

  // Calcular rango.
  let minDate = movements[0]!.movement_date
  let maxDate = movements[0]!.movement_date
  for (const m of movements) {
    if (m.movement_date < minDate) minDate = m.movement_date
    if (m.movement_date > maxDate) maxDate = m.movement_date
  }

  const minMs = new Date(`${minDate}T00:00:00`).getTime()
  const maxMs = new Date(`${maxDate}T00:00:00`).getTime()
  const spanDays = Math.floor((maxMs - minMs) / 86400000)
  const granularity: 'week' | 'month' = spanDays <= 60 ? 'week' : 'month'

  const buckets = new Map<string, { income: number; expenses: number; net: number }>()

  for (const m of movements) {
    if (m.type === 'pendiente') continue
    const bucketStart = granularity === 'week'
      ? toWeekStart(m.movement_date)
      : toMonthStart(m.movement_date)

    let b = buckets.get(bucketStart)
    if (!b) {
      b = { income: 0, expenses: 0, net: 0 }
      buckets.set(bucketStart, b)
    }
    const amt = Number(m.amount) || 0
    if (m.type === 'ingreso') b.income += amt
    else b.expenses += amt
    b.net = b.income - b.expenses
  }

  const points = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketStart, v]) => ({ bucketStart, ...v }))

  return { granularity, points }
}

function toMonthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

/** Primer día (lunes) de la semana ISO que contiene la fecha. */
function toWeekStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const day = dt.getDay() // 0=domingo
  const diff = day === 0 ? -6 : 1 - day // a lunes
  dt.setDate(dt.getDate() + diff)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
