import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import { GIROS, ESTADOS_MX, TIMEZONE_MAP, USER_CATEGORIES_CAP, CATEGORIES_MASTER, isValidCategoryName } from '@/lib/constants'

/**
 * POST /api/onboarding/profile-prompt
 *
 * Modal post-primer-movimiento (v0.292+) que pide ciudad/estado/giro como
 * datos opcionales. v0.32: agrega `categories` opcional para que el step
 * final del modal persista la lista curada en el mismo POST (en vez de
 * dos roundtrips).
 *
 * Body opcional: { ciudad?, estado?, giro?, categories?: string[],
 *                  reason: 'submitted' | 'dismissed' }
 *
 * Comportamiento:
 *  - Siempre marca `profile_prompt_seen_at = NOW()`.
 *  - Si vienen categories: las valida (cap, dedupe, Pro-gate custom) y
 *    setea también `categories` + `categories_seen_at = NOW()`.
 *  - Si NO vienen (user dismissed antes de llegar al step categories):
 *    deja `categories_seen_at` NULL para que el modal bloqueante de
 *    categorías les caiga después.
 *  - estado se valida contra ESTADOS_MX; giro contra GIROS.
 *  - Setea timezone derivado del estado si vino.
 *
 * Idempotente.
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
  let rawCategories: unknown
  let reason: 'submitted' | 'dismissed' = 'submitted'
  try {
    const body = (await request.json()) as {
      ciudad?: unknown; estado?: unknown; giro?: unknown
      categories?: unknown; reason?: unknown
    }
    if (typeof body?.ciudad === 'string') ciudad = body.ciudad.trim().slice(0, 80)
    if (typeof body?.estado === 'string') estado = body.estado.trim()
    if (typeof body?.giro   === 'string') giro   = body.giro.trim()
    if (body?.reason === 'dismissed')     reason = 'dismissed'
    rawCategories = body?.categories
  } catch {
    reason = 'dismissed'
  }

  // Validación profile fields
  if (estado && !(ESTADOS_MX as readonly string[]).includes(estado)) estado = undefined
  if (giro   && !(GIROS as readonly string[]).includes(giro))         giro   = undefined

  // Validación categorías (si vinieron)
  let cleanedCategories: string[] | undefined
  if (Array.isArray(rawCategories)) {
    const seen = new Set<string>()
    const cleaned: string[] = []
    for (const raw of rawCategories) {
      if (!isValidCategoryName(raw)) continue
      const trimmed = (raw as string).trim()
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      cleaned.push(trimmed)
    }
    if (cleaned.length > USER_CATEGORIES_CAP) {
      return Response.json(
        { error: `Máximo ${USER_CATEGORIES_CAP} categorías` },
        { status: 400 },
      )
    }
    // Pro-gate: si hay items custom (no en master), verificar plan
    const masterSet = new Set<string>(CATEGORIES_MASTER)
    const customItems = cleaned.filter(c => !masterSet.has(c))
    if (customItems.length > 0) {
      const { data: profileForPlan } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      if ((profileForPlan?.plan as string) !== 'pro') {
        return Response.json(
          { error: 'Las categorías personalizadas son Pro', code: 'PRO_REQUIRED' },
          { status: 403 },
        )
      }
    }
    cleanedCategories = cleaned
  }

  const patch: Record<string, unknown> = {
    profile_prompt_seen_at: new Date().toISOString(),
  }
  if (ciudad) patch.ciudad = ciudad
  if (estado) {
    patch.estado   = estado
    patch.timezone = TIMEZONE_MAP[estado] ?? 'America/Mexico_City'
  }
  if (giro)   patch.giro = giro
  if (cleanedCategories && cleanedCategories.length > 0) {
    patch.categories         = cleanedCategories
    patch.categories_seen_at = new Date().toISOString()
  }

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
    filled_categories: !!cleanedCategories,
    categories_count: cleanedCategories?.length ?? 0,
  })

  return Response.json({ ok: true })
}
