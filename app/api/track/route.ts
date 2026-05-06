import { createClient as createSSRClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
 * Devuelve 204 en TODOS los casos (incluso errores) — analytics no debe
 * ser un canal que el cliente use para detectar otra cosa, y queremos que
 * el browser no intente reintentos.
 */

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
    const body = await request.json().catch(() => null)
    if (!body || typeof (body as Record<string, unknown>).event !== 'string') {
      return new Response(null, { status: 204 })
    }

    const event = ((body as { event: string }).event).slice(0, 80)
    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(null, { status: 204 })
    }

    const rawPayload = (body as { payload?: unknown }).payload
    const payload: Record<string, unknown> =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? { ...(rawPayload as Record<string, unknown>) }
        : {}

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
