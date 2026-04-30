/**
 * Helper server-side para insertar en `analytics_events` desde API routes.
 * Fail-soft: si el insert falla, lo logueamos y seguimos — analytics nunca
 * debe tirar una request de negocio.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function trackServer(
  supabase: SupabaseClient,
  userId: string,
  event: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from('analytics_events').insert({
      user_id: userId,
      event_name: event.slice(0, 80),
      payload: payload ?? {},
    })
    if (error) {
      console.error('[analytics] insert failed', event, error.message)
    }
  } catch (err) {
    console.error('[analytics] threw', event, err instanceof Error ? err.message : err)
  }
}
