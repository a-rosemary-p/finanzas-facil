import { createClient } from '@/lib/supabase/server'
import { CATEGORIES_ALL, MOVEMENT_TYPES } from '@/lib/constants'
import type { Movement } from '@/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/

  if (body['type'] !== undefined) {
    if (!MOVEMENT_TYPES.includes(body['type'] as (typeof MOVEMENT_TYPES)[number])) {
      return Response.json({ error: 'Tipo inválido' }, { status: 400 })
    }
    patch['type'] = body['type']
  }
  if (body['amount'] !== undefined) {
    const amt = Number(body['amount'])
    if (!isFinite(amt) || amt <= 0) return Response.json({ error: 'Monto inválido' }, { status: 400 })
    patch['amount'] = Math.round(amt * 100) / 100
  }
  if (body['description'] !== undefined) {
    const desc = String(body['description']).trim().slice(0, 60)
    if (!desc) return Response.json({ error: 'Descripción requerida' }, { status: 400 })
    patch['description'] = desc
  }
  if (body['movementDate'] !== undefined) {
    if (!dateRegex.test(String(body['movementDate']))) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    patch['movement_date'] = body['movementDate']
  }
  if (body['isInvestment'] !== undefined) {
    patch['is_investment'] = Boolean(body['isInvestment'])
  }
  if (body['category'] !== undefined) {
    // Acepta nuevas + legacy: editar un mov viejo con 'Ingredientes' no debe
    // forzar pasar a 'Otro' si el user no tocó la categoría.
    patch['category'] = CATEGORIES_ALL.includes(body['category'] as (typeof CATEGORIES_ALL)[number])
      ? body['category']
      : 'Otro'
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  // ── Audit trail (v0.27 sprint 1) ────────────────────────────────────────
  // Antes de mutar, leemos los valores actuales para poder loguear "prev_*"
  // en movement_events. Sin esto solo sabríamos el estado final.
  const { data: before } = await supabase
    .from('movements')
    .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Caso especial: pagar un pendiente. Detectamos cambio type=pendiente→gasto
  // y agregamos paid_at + original_type al UPDATE para preservar la señal.
  // (También se loguea como evento 'paid' abajo.)
  const isPaying =
    before?.type === 'pendiente' &&
    patch['type'] === 'gasto'
  if (isPaying) {
    patch['paid_at'] = new Date().toISOString()
    patch['original_type'] = 'pendiente'
  }

  const { data, error } = await supabase
    .from('movements')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, type, amount, description, category, movement_date, is_investment, paid_at, original_type')
    .single()

  if (error || !data) {
    console.error('[PATCH /api/movements/:id]', error)
    return Response.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }

  // Loguear evento. Fail-soft: si falla, no rompemos el update — el audit es
  // bonus, no crítico. Si vamos a depender de este audit para algo crítico
  // en el futuro, considerar trigger DB en lugar de inserción manual.
  const eventType: 'paid' | 'edited' = isPaying ? 'paid' : 'edited'
  const payload: Record<string, unknown> = {}
  if (before) {
    if (patch['type'] !== undefined && before.type !== patch['type']) {
      payload['prev_type'] = before.type
      payload['new_type'] = patch['type']
    }
    if (patch['amount'] !== undefined && Number(before.amount) !== patch['amount']) {
      payload['prev_amount'] = Number(before.amount)
      payload['new_amount'] = patch['amount']
    }
    if (patch['description'] !== undefined && before.description !== patch['description']) {
      payload['prev_description'] = before.description
      payload['new_description'] = patch['description']
    }
    if (patch['category'] !== undefined && before.category !== patch['category']) {
      payload['prev_category'] = before.category
      payload['new_category'] = patch['category']
    }
    if (patch['movement_date'] !== undefined && before.movement_date !== patch['movement_date']) {
      payload['prev_movement_date'] = before.movement_date
      payload['new_movement_date'] = patch['movement_date']
    }
    if (patch['is_investment'] !== undefined && before.is_investment !== patch['is_investment']) {
      payload['prev_is_investment'] = before.is_investment
      payload['new_is_investment'] = patch['is_investment']
    }
  }
  // Solo logueamos si algo de verdad cambió.
  if (Object.keys(payload).length > 0) {
    const { error: evtErr } = await supabase
      .from('movement_events')
      .insert({
        movement_id: id,
        user_id: user.id,
        event_type: eventType,
        payload,
      })
    if (evtErr) console.error('[PATCH /api/movements/:id] event insert failed', evtErr)
  }

  const movement: Movement = {
    id: data['id'] as string,
    type: data['type'] as Movement['type'],
    amount: data['amount'] as number,
    description: data['description'] as string,
    category: data['category'] as Movement['category'],
    movementDate: data['movement_date'] as string,
    isInvestment: (data['is_investment'] as boolean) ?? false,
  }

  return Response.json({ movement })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE /api/movements/:id]', error)
    return Response.json({ error: 'No se pudo borrar' }, { status: 500 })
  }

  return Response.json({ deleted: true })
}
