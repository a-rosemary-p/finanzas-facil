import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
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
    patch['category'] = CATEGORIES.includes(body['category'] as (typeof CATEGORIES)[number])
      ? body['category']
      : 'Otro'
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('movements')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, type, amount, description, category, movement_date, is_investment')
    .single()

  if (error || !data) {
    console.error('[PATCH /api/movements/:id]', error)
    return Response.json({ error: 'No se pudo actualizar' }, { status: 500 })
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
