import { createClient } from '@/lib/supabase/server'
import { CATEGORIES_ALL } from '@/lib/constants'
import { materializeNextPending } from '@/lib/recurring/materialize'
import type { RecurringMovement, RecurringFrequency } from '@/types'

const FREQUENCIES = new Set<RecurringFrequency>(['week', 'month', 'year'])
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/recurring
 * Lista de recurrentes del user. Activos primero, luego pausados.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('recurring_movements')
    .select('id, type, amount, description, category, frequency, next_due_date, is_active, last_materialized_at, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_active', { ascending: false })
    .order('next_due_date', { ascending: true })

  if (error) {
    console.error('[GET /api/recurring]', error)
    return Response.json({ error: 'Error al cargar' }, { status: 500 })
  }

  const recurring: RecurringMovement[] = (data ?? []).map(r => ({
    id: r.id as string,
    type: r.type as RecurringMovement['type'],
    amount: Number(r.amount),
    description: r.description as string,
    category: r.category as RecurringMovement['category'],
    frequency: r.frequency as RecurringFrequency,
    nextDueDate: r.next_due_date as string,
    isActive: (r.is_active as boolean) ?? true,
    lastMaterializedAt: (r.last_materialized_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }))

  return Response.json({ recurring })
}

/**
 * POST /api/recurring
 * Crea un recurrente Y materializa el primer pendiente inmediatamente.
 *
 * Body: { type, amount, description, category, frequency, nextDueDate }
 *   - nextDueDate es la fecha del PRIMER pendiente. Después se avanza
 *     automáticamente cada vez que se paga uno y se materializa el siguiente.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>

  // ── Validación ────────────────────────────────────────────────────────
  const type = body['type']
  if (type !== 'ingreso' && type !== 'gasto') {
    return Response.json({ error: 'type inválido (ingreso|gasto)' }, { status: 400 })
  }
  const amount = Number(body['amount'])
  if (!isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'Monto inválido' }, { status: 400 })
  }
  const description = String(body['description'] ?? '').trim().slice(0, 60)
  if (!description) {
    return Response.json({ error: 'Descripción requerida' }, { status: 400 })
  }
  const rawCategory = String(body['category'] ?? '')
  const category = CATEGORIES_ALL.includes(rawCategory as (typeof CATEGORIES_ALL)[number])
    ? rawCategory : 'Otro'
  const frequency = body['frequency']
  if (typeof frequency !== 'string' || !FREQUENCIES.has(frequency as RecurringFrequency)) {
    return Response.json({ error: 'frequency inválida (week|month|year)' }, { status: 400 })
  }
  const nextDueDate = String(body['nextDueDate'] ?? '')
  if (!dateRegex.test(nextDueDate)) {
    return Response.json({ error: 'nextDueDate inválida (YYYY-MM-DD)' }, { status: 400 })
  }

  // ── Insert template ───────────────────────────────────────────────────
  const { data: rec, error: insertErr } = await supabase
    .from('recurring_movements')
    .insert({
      user_id: user.id,
      type,
      amount: Math.round(amount * 100) / 100,
      description,
      category,
      frequency,
      next_due_date: nextDueDate,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertErr || !rec) {
    console.error('[POST /api/recurring]', insertErr)
    return Response.json({ error: 'No se pudo crear' }, { status: 500 })
  }

  // ── Materializar primer pendiente ─────────────────────────────────────
  // Fail-soft: si la materialización falla, el recurrente ya existe; el
  // próximo intento (manual o futuro reconcile) lo agarra.
  const movementId = await materializeNextPending(supabase, rec.id as string)

  return Response.json({ recurringId: rec.id, firstPendingId: movementId })
}
