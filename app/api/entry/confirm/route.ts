import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/constants'
import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
import type { Entry, Movement } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Validar input
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { rawText, entryDate, movements } = body as Record<string, unknown>

    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      return Response.json({ error: 'Texto original requerido' }, { status: 400 })
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof entryDate !== 'string' || !dateRegex.test(entryDate)) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    if (!Array.isArray(movements) || movements.length === 0) {
      return Response.json({ error: 'Debe haber al menos un movimiento' }, { status: 400 })
    }

    // Sanitizar movimientos recibidos del cliente
    const sanitized = movements
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .filter(m => MOVEMENT_TYPES.includes(m['type'] as (typeof MOVEMENT_TYPES)[number]))
      .filter(m => typeof m['amount'] === 'number' && isFinite(m['amount'] as number) && (m['amount'] as number) > 0)
      .filter(m => typeof m['description'] === 'string' && (m['description'] as string).trim().length > 0)
      .map(m => ({
        type: m['type'] as Movement['type'],
        amount: Math.round((m['amount'] as number) * 100) / 100,
        description: (m['description'] as string).trim().slice(0, 60),
        category: CATEGORIES.includes(m['category'] as (typeof CATEGORIES)[number])
          ? (m['category'] as Movement['category'])
          : ('Otro' as const),
        movementDate:
          typeof m['movementDate'] === 'string' && dateRegex.test(m['movementDate'] as string)
            ? (m['movementDate'] as string)
            : entryDate,
      }))

    if (sanitized.length === 0) {
      return Response.json({ error: 'No hay movimientos válidos' }, { status: 400 })
    }

    // 3. Re-verificar límite en servidor (fuente de verdad)
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, movements_today, movements_today_date')
      .eq('id', user.id)
      .single()

    if (profile && profile.plan === 'free') {
      const today = new Date().toISOString().split('T')[0]
      const isToday = profile.movements_today_date === today
      const usedToday = isToday ? (profile.movements_today as number) : 0
      const remaining = PLANS.FREE.maxMovementsPerDay - usedToday

      if (sanitized.length > remaining) {
        return Response.json(
          {
            error: 'LIMIT_EXCEEDED',
            message: `Solo te quedan ${remaining} movimiento(s) hoy en el plan Free. Elimina algunos o actualiza a Pro.`,
            remaining,
          },
          { status: 429 }
        )
      }
    }

    // 4. Guardar entry
    const { data: entryRow, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: rawText.trim(),
        entry_date: entryDate,
        input_source: 'text',
      })
      .select('id, raw_text, entry_date, created_at')
      .single()

    if (entryError || !entryRow) {
      console.error('[confirm] entry insert error', entryError)
      return Response.json({ error: 'Error al guardar la entrada' }, { status: 500 })
    }

    // 5. Guardar movements (el trigger auto-incrementa movements_today)
    const movementRows = sanitized.map(m => ({
      entry_id: entryRow.id as string,
      user_id: user.id,
      type: m.type,
      amount: m.amount,
      description: m.description,
      category: m.category,
      movement_date: m.movementDate,
    }))

    const { data: savedMovements, error: movError } = await supabase
      .from('movements')
      .insert(movementRows)
      .select('id, type, amount, description, category, movement_date')

    if (movError || !savedMovements) {
      console.error('[confirm] movements insert error', movError)
      return Response.json({ error: 'Error al guardar los movimientos' }, { status: 500 })
    }

    // 6. Devolver la entry completa
    const entry: Entry = {
      id: entryRow.id as string,
      rawText: entryRow.raw_text as string,
      entryDate: entryRow.entry_date as string,
      createdAt: entryRow.created_at as string,
      movements: savedMovements.map(m => ({
        id: m.id as string,
        type: m.type as Movement['type'],
        amount: m.amount as number,
        description: m.description as string,
        category: m.category as Movement['category'],
        movementDate: m.movement_date as string,
      })),
    }

    return Response.json({ entry })
  } catch (error: unknown) {
    console.error('[POST /api/entry/confirm]', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Error al confirmar. Intenta de nuevo.' }, { status: 500 })
  }
}
