import { createClient } from '@/lib/supabase/server'
import { CATEGORIES_ALL } from '@/lib/constants'
import { materializeNextPending } from '@/lib/recurring/materialize'

const FREQUENCIES = new Set(['week', 'month', 'year'])
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

/**
 * PATCH /api/recurring/[id]
 *
 * Actualiza el template del recurrente. NO modifica el pendiente actualmente
 * materializado — los cambios afectan los siguientes que se generen.
 *
 * Si el cambio es `isActive: true → false` (pausar), no toca el pendiente
 * vivo. Si es `false → true` (reactivar) y no hay pendiente vivo, intenta
 * materializar uno (caso "pausé, mientras tanto pagué el último, ahora resumo").
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if (body['type'] !== undefined) {
    if (body['type'] !== 'ingreso' && body['type'] !== 'gasto') {
      return Response.json({ error: 'type inválido' }, { status: 400 })
    }
    patch['type'] = body['type']
  }
  if (body['amount'] !== undefined) {
    const amt = Number(body['amount'])
    if (!isFinite(amt) || amt <= 0) {
      return Response.json({ error: 'Monto inválido' }, { status: 400 })
    }
    patch['amount'] = Math.round(amt * 100) / 100
  }
  if (body['description'] !== undefined) {
    const desc = String(body['description']).trim().slice(0, 60)
    if (!desc) return Response.json({ error: 'Descripción requerida' }, { status: 400 })
    patch['description'] = desc
  }
  if (body['category'] !== undefined) {
    patch['category'] = CATEGORIES_ALL.includes(body['category'] as (typeof CATEGORIES_ALL)[number])
      ? body['category'] : 'Otro'
  }
  if (body['frequency'] !== undefined) {
    if (!FREQUENCIES.has(String(body['frequency']))) {
      return Response.json({ error: 'frequency inválida' }, { status: 400 })
    }
    patch['frequency'] = body['frequency']
  }
  if (body['nextDueDate'] !== undefined) {
    if (!dateRegex.test(String(body['nextDueDate']))) {
      return Response.json({ error: 'nextDueDate inválida' }, { status: 400 })
    }
    patch['next_due_date'] = body['nextDueDate']
  }

  // is_active: detección antes/después para saber si fue resumir.
  let resumeRequested = false
  if (body['isActive'] !== undefined) {
    patch['is_active'] = Boolean(body['isActive'])

    // ¿Estaba inactivo y va a volverse activo?
    const { data: before } = await supabase
      .from('recurring_movements')
      .select('is_active')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (before && before.is_active === false && patch['is_active'] === true) {
      resumeRequested = true
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  patch['updated_at'] = new Date().toISOString()

  const { error } = await supabase
    .from('recurring_movements')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/recurring/:id]', error)
    return Response.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }

  // Si el user resumió un recurrente pausado, intentar materializar.
  // El helper es idempotente — si ya hay pendiente vivo, no hace nada.
  if (resumeRequested) {
    await materializeNextPending(supabase, id)
  }

  return Response.json({ ok: true })
}

/**
 * DELETE /api/recurring/[id]
 *
 * Borra el template. El pendiente actualmente materializado queda huérfano
 * (FK ON DELETE SET NULL) — sigue existiendo y se puede pagar normal, solo
 * que ya no genera otro al pagarse.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('recurring_movements')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE /api/recurring/:id]', error)
    return Response.json({ error: 'No se pudo borrar' }, { status: 500 })
  }

  return Response.json({ deleted: true })
}
