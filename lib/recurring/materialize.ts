/**
 * Materialización de recurrentes — server-side helper.
 *
 * Modelo:
 *   - Cada recurrente activo tiene EXACTAMENTE UN pendiente "vivo" en
 *     `movements` a la vez. "Vivo" = type='pendiente' (no fue pagado).
 *   - Al crear un recurrente: se materializa el primer pendiente inmediato.
 *   - Al pagar un pendiente cuyo `recurring_movement_id` apunta a un
 *     recurrente activo: se materializa el siguiente.
 *   - Idempotencia: si ya existe un pendiente vivo para este recurrente,
 *     `materializeNextPending` no hace nada y devuelve null.
 *
 * No usamos pg_cron — toda la materialización es event-driven desde la
 * aplicación (POST /api/recurring + PATCH /api/movements/[id] al pagar).
 *
 * Si necesitas correr esto desde un trigger de DB futuro, esto se podría
 * portar a una función PL/pgSQL — el algoritmo es directo.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecurringFrequency } from '@/types'

interface RecurringRow {
  id: string
  user_id: string
  type: 'ingreso' | 'gasto'
  amount: number | string
  description: string
  category: string
  frequency: RecurringFrequency
  next_due_date: string  // YYYY-MM-DD
  is_active: boolean
}

/**
 * Crea el siguiente pendiente desde un recurrente y avanza next_due_date.
 *
 * @returns ID del movimiento creado, o null si no se materializó (recurrente
 *   inactivo, o ya tiene un pendiente vivo).
 */
export async function materializeNextPending(
  supabase: SupabaseClient,
  recurringId: string,
): Promise<string | null> {
  // 1. Lee el template
  const { data: rec, error: recErr } = await supabase
    .from('recurring_movements')
    .select('id, user_id, type, amount, description, category, frequency, next_due_date, is_active')
    .eq('id', recurringId)
    .single<RecurringRow>()

  if (recErr || !rec) return null
  if (!rec.is_active) return null

  // 2. Idempotencia: ¿hay un pendiente vivo con este recurring_movement_id?
  const { data: existing } = await supabase
    .from('movements')
    .select('id')
    .eq('recurring_movement_id', recurringId)
    .eq('type', 'pendiente')
    .limit(1)
    .maybeSingle()

  if (existing) return null

  // 3. Crear entry sintético — `entries` requiere raw_text + entry_date NOT NULL.
  //    Marcamos input_source='recurring' para que el frontend pueda distinguir.
  const { data: entry, error: entryErr } = await supabase
    .from('entries')
    .insert({
      user_id: rec.user_id,
      raw_text: `Recurrente: ${rec.description}`,
      input_source: 'recurring',
      entry_date: rec.next_due_date,
    })
    .select('id')
    .single()

  if (entryErr || !entry) return null

  // 4. Crear el pendiente. type='pendiente', pending_direction = recurrente.type.
  const { data: mov, error: movErr } = await supabase
    .from('movements')
    .insert({
      entry_id: entry.id,
      user_id: rec.user_id,
      type: 'pendiente',
      amount: Number(rec.amount),
      description: rec.description,
      category: rec.category,
      movement_date: rec.next_due_date,
      is_investment: false,
      pending_direction: rec.type,
      recurring_movement_id: rec.id,
      original_type: 'pendiente',
    })
    .select('id')
    .single()

  if (movErr || !mov) {
    console.error('[materializeNextPending] movement insert failed', movErr)
    return null
  }

  // 5. Avanzar next_due_date + last_materialized_at
  const next = advanceDate(rec.next_due_date, rec.frequency)
  const { error: updateErr } = await supabase
    .from('recurring_movements')
    .update({
      next_due_date: next,
      last_materialized_at: new Date().toISOString(),
    })
    .eq('id', recurringId)

  if (updateErr) {
    console.error('[materializeNextPending] could not advance next_due_date', updateErr)
    // No revertimos el INSERT — el pendiente ya existe y es válido. El
    // siguiente intento de materializar verá el pendiente vivo y skip.
  }

  // 6. Audit event
  await supabase.from('movement_events').insert({
    movement_id: mov.id,
    user_id: rec.user_id,
    event_type: 'recurring_materialized',
    payload: {
      recurring_movement_id: rec.id,
      frequency: rec.frequency,
      next_due_date: next,
    },
  })

  return mov.id as string
}

/**
 * Avanza una fecha YYYY-MM-DD en una unidad de frecuencia.
 * Edge cases:
 * - month: si el día actual es 31 y el siguiente mes solo tiene 30 (o feb),
 *   JS automáticamente "rola" al mes siguiente. Nosotros lo capamos al
 *   último día del mes destino para que "renta el 31" siga el día 31 (o el
 *   último día disponible) en lugar de saltarse a "1 del mes siguiente".
 * - year + 29-feb: si era 2024-02-29, en 2025 cae a 2025-02-28 (capado).
 */
export function advanceDate(ymd: string, frequency: RecurringFrequency): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Invalid date: ${ymd}`)

  let targetY = y, targetM = m, targetD = d

  switch (frequency) {
    case 'week': {
      const dt = new Date(y, m - 1, d)
      dt.setDate(dt.getDate() + 7)
      targetY = dt.getFullYear()
      targetM = dt.getMonth() + 1
      targetD = dt.getDate()
      break
    }
    case 'month': {
      targetM = m + 1
      if (targetM > 12) { targetM = 1; targetY = y + 1 }
      // Cap al último día del mes destino si el día original era mayor
      const lastDay = new Date(targetY, targetM, 0).getDate()
      if (targetD > lastDay) targetD = lastDay
      break
    }
    case 'year': {
      targetY = y + 1
      // Cap si era 29-feb y el año destino no es bisiesto
      const lastDay = new Date(targetY, targetM, 0).getDate()
      if (targetD > lastDay) targetD = lastDay
      break
    }
  }

  return `${targetY}-${String(targetM).padStart(2, '0')}-${String(targetD).padStart(2, '0')}`
}
