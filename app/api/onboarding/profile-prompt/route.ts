import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import { GIROS, ESTADOS_MX, TIMEZONE_MAP } from '@/lib/constants'

/**
 * POST /api/onboarding/profile-prompt
 *
 * Modal post-primer-movimiento (v0.292) que pide ciudad/estado/giro como
 * datos opcionales. Se dispara UNA vez tras el primer movement.
 *
 * Body opcional: { ciudad?: string, estado?: string, giro?: string,
 *                  reason?: 'submitted' | 'dismissed' }
 *
 * Comportamiento:
 *  - Siempre marca `profile_prompt_seen_at = NOW()` para no volver a aparecer.
 *  - Solo persiste los campos que el user llenó (los vacíos se ignoran).
 *  - estado se valida contra ESTADOS_MX; giro contra GIROS. Valores
 *    inválidos se ignoran silenciosamente (defense-in-depth).
 *  - Setea timezone derivado del estado si vino, igual que useAuth.updateProfile.
 *
 * Idempotente — si el usuario lo dispara varias veces, no rompe nada.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  let ciudad:  string | undefined
  let estado:  string | undefined
  let giro:    string | undefined
  let reason: 'submitted' | 'dismissed' = 'submitted'
  try {
    const body = (await request.json()) as {
      ciudad?: unknown; estado?: unknown; giro?: unknown; reason?: unknown
    }
    if (typeof body?.ciudad === 'string') ciudad = body.ciudad.trim().slice(0, 80)
    if (typeof body?.estado === 'string') estado = body.estado.trim()
    if (typeof body?.giro   === 'string') giro   = body.giro.trim()
    if (body?.reason === 'dismissed')     reason = 'dismissed'
  } catch {
    // body vacío / no-JSON → tratado como dismissed sin datos
    reason = 'dismissed'
  }

  // Validación
  if (estado && !(ESTADOS_MX as readonly string[]).includes(estado)) estado = undefined
  if (giro   && !(GIROS as readonly string[]).includes(giro))         giro   = undefined

  const patch: Record<string, unknown> = {
    profile_prompt_seen_at: new Date().toISOString(),
  }
  if (ciudad) patch.ciudad = ciudad
  if (estado) {
    patch.estado   = estado
    patch.timezone = TIMEZONE_MAP[estado] ?? 'America/Mexico_City'
  }
  if (giro)   patch.giro = giro

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) {
    console.error('[POST /api/onboarding/profile-prompt]', error)
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  await trackServer(supabase, user.id, 'profile_prompt_seen', {
    reason,
    filled_ciudad: !!ciudad,
    filled_estado: !!estado,
    filled_giro:   !!giro,
  })

  return Response.json({ ok: true })
}
