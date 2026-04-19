import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
import type { Movement } from '@/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { type, amount, description, movementDate } = body as Record<string, unknown>

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const updates: Record<string, unknown> = {}

    if (type !== undefined) {
      if (!MOVEMENT_TYPES.includes(type as (typeof MOVEMENT_TYPES)[number])) {
        return Response.json({ error: 'Tipo inválido' }, { status: 400 })
      }
      updates['type'] = type
    }
    if (amount !== undefined) {
      const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
      if (!isFinite(n) || n <= 0) {
        return Response.json({ error: 'Monto inválido' }, { status: 400 })
      }
      updates['amount'] = Math.round(n * 100) / 100
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || (description as string).trim().length === 0) {
        return Response.json({ error: 'Descripción inválida' }, { status: 400 })
      }
      updates['description'] = (description as string).trim().slice(0, 60)
    }
    if (movementDate !== undefined) {
      if (typeof movementDate !== 'string' || !dateRegex.test(movementDate as string)) {
        return Response.json({ error: 'Fecha inválida' }, { status: 400 })
      }
      updates['movement_date'] = movementDate
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('movements')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, type, amount, description, category, movement_date')
      .single()

    if (error || !data) {
      console.error('[PATCH /api/movements/[id]]', error)
      return Response.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    const movement: Movement = {
      id: data.id as string,
      type: data.type as Movement['type'],
      amount: data.amount as number,
      description: data.description as string,
      category: data.category as Movement['category'],
      movementDate: data.movement_date as string,
    }

    return Response.json({ movement })
  } catch (error: unknown) {
    console.error('[PATCH /api/movements/[id]]', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

    const { error } = await supabase
      .from('movements')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[DELETE /api/movements/[id]]', error)
      return Response.json({ error: 'Error al borrar' }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('[DELETE /api/movements/[id]]', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
