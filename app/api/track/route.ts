import { createClient as createSSRClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { consumeIpRateLimit } from '@/lib/ip-rate-limit'

/**
 * POST /api/track
 *
 * Body: { event: string, payload?: Record<string, unknown> }
 *
 * Inserta en `analytics_events`. user_id se llena con la sesión si existe;
 * para visitas anónimas (landing, login) queda NULL — v0.292 amplía el
 * scope para soportar analytics de página completa, no solo post-login.
 *
 * Server-side enrichment (v0.292):
 *  - `country` del header `x-vercel-ip-country` (Vercel edge geolocation)
 *  - `device` parseado del user-agent (mobile / tablet / desktop)
 *  - `ua` (truncado a 200 chars) para debugging
 *
 * Por qué service-role para el INSERT:
 *  La policy RLS de analytics_events es `TO authenticated WITH CHECK
 *  (auth.uid() = user_id)`. Para visitas anónimas no hay auth.uid(), así
 *  que el insert con el cliente del usuario fallaría. Usamos admin client
 *  solo para el INSERT, después de validar evento + payload.
 *
 * Defense-in-depth: ALLOWED_EVENTS allowlist evita que un atacante use
 * este endpoint para flotar la tabla con eventos arbitrarios.
 *
 * Anti-abuso (agregado tras la auditoría de jul 2026):
 *  - Rate limit por IP (300/hora). El allowlist de eventos no impedía que un
 *    bot inflara la tabla en loop y contaminara todos los KPIs del dashboard
 *    de founders (visitors, top pages, países, UTMs salen de estos campos,
 *    que los controla el cliente).
 *  - Cap de tamaño del payload. Antes se copiaba `{ ...rawPayload }` tal cual,
 *    sin límite de bytes ni de claves — un payload gigante por request era
 *    crecimiento de storage sin techo.
 *
 * Devuelve 204 en TODOS los casos (incluso errores) — analytics no debe
 * ser un canal que el cliente use para detectar otra cosa, y queremos que
 * el browser no intente reintentos.
 */

/** Cap del payload que manda el cliente (antes del enrichment del server). */
const MAX_PAYLOAD_BYTES = 2048
const MAX_PAYLOAD_KEYS = 25

const ALLOWED_EVENTS = new Set<string>([
  'page_viewed',
  'report_exported',
  'onboarding_completed',
  'pending_paid',
  'movements_filter_changed',
  'report_filter_changed',
  'entry_created',
  'recurring_created',
  'insights_requested',
])

function parseDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const u = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk(?!.*mobile)/.test(u)) return 'tablet'
  if (/mobi|iphone|android.*mobile|phone|opera mini/.test(u)) return 'mobile'
  return 'desktop'
}

export async function POST(request: Request) {
  try {
    // Rate limit por IP antes de tocar el body o la DB.
    const allowed = await consumeIpRateLimit(request, 'track')
    if (!allowed) return new Response(null, { status: 204 })

    const body = await request.json().catch(() => null)
    if (!body || typeof (body as Record<string, unknown>).event !== 'string') {
      return new Response(null, { status: 204 })
    }

    const event = ((body as { event: string }).event).slice(0, 80)
    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(null, { status: 204 })
    }

    const rawPayload = (body as { payload?: unknown }).payload
    let payload: Record<string, unknown> =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? { ...(rawPayload as Record<string, unknown>) }
        : {}

    // Cap de claves y de bytes. Si el cliente manda algo desproporcionado lo
    // descartamos y dejamos una marca — preferimos perder el detalle del evento
    // antes que aceptar filas sin techo de tamaño.
    const keys = Object.keys(payload)
    if (keys.length > MAX_PAYLOAD_KEYS) {
      payload = { _truncated: 'too_many_keys' }
    } else if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      payload = { _truncated: 'too_large' }
    }

    // ── Enrichment server-side ─────────────────────────────────────────
    const country = request.headers.get('x-vercel-ip-country')
    if (country) payload.country = country

    const ua = request.headers.get('user-agent') ?? ''
    if (ua) {
      payload.device = parseDevice(ua)
      payload.ua = ua.slice(0, 200)
    }

    // ── User context (opcional) ────────────────────────────────────────
    let userId: string | null = null
    try {
      const supabase = await createSSRClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      userId = null
    }

    // ── Insert con service-role (bypassea RLS para anon inserts) ───────
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await admin.from('analytics_events').insert({
      user_id: userId,
      event_name: event,
      payload,
    })
  } catch {
    // Fail-soft: cualquier error queda en logs del server, el cliente
    // siempre recibe 204.
  }
  return new Response(null, { status: 204 })
}
