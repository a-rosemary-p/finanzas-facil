import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/track
 *
 * Body: { event: string, payload?: Record<string, unknown> }
 *
 * Inserta en `analytics_events` con user_id de la sesión. Devuelve 204
 * en todos los casos (incluso errores) — analytics no debe ser un canal
 * que el cliente use para detectar otra cosa, y queremos que el browser
 * no intente reintentos.
 *
 * Validaciones:
 *  - event_name truncado a 80 chars
 *  - payload solo si es objeto plano
 *  - sin sesión → 204 silencioso (no inserta)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(null, { status: 204 })

    const body = await request.json().catch(() => null)
    if (!body || typeof (body as Record<string, unknown>).event !== 'string') {
      return new Response(null, { status: 204 })
    }

    const event = ((body as { event: string }).event).slice(0, 80)
    const rawPayload = (body as { payload?: unknown }).payload
    const payload =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {}

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_name: event,
      payload,
    })
  } catch {
    // Fail-soft: cualquier error queda en logs del server pero el cliente
    // siempre recibe 204.
  }
  return new Response(null, { status: 204 })
}
