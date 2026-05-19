import { createClient } from '@/lib/supabase/server'
import { CATEGORIES_MASTER, USER_CATEGORIES_CAP, isValidCategoryName } from '@/lib/constants'
import { trackServer } from '@/lib/analytics-server'

/**
 * GET /api/profile/categories
 *
 * Devuelve la lista curada del user ordenada por uso reciente (deriva
 * `MAX(created_at)` por categoría desde `movements`). Categorías nunca
 * usadas van al final en el orden persistido en `profiles.categories`.
 *
 * También devuelve el flag `markedSeen` (de `categories_seen_at`) y la
 * lista master por conveniencia para el picker.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, giro, categories, categories_seen_at')
    .eq('id', user.id)
    .single()

  const stored = (profile?.categories as string[] | null) ?? []

  // Sorting por uso reciente — query agregado a movements.
  // Solo necesitamos categorías que el user ya tiene en su lista; cualquier
  // otra cat histórica no se ordena (se queda en su orden persistido).
  const { data: usage } = await supabase
    .from('movements')
    .select('category, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500) // suficiente para tener orden razonable; no toda la historia

  const lastUsed = new Map<string, string>()
  for (const row of usage ?? []) {
    const cat = (row as { category: string }).category
    if (!lastUsed.has(cat)) {
      lastUsed.set(cat, (row as { created_at: string }).created_at)
    }
  }

  const sorted = [...stored].sort((a, b) => {
    const ua = lastUsed.get(a)
    const ub = lastUsed.get(b)
    if (ua && ub) return ub.localeCompare(ua) // desc
    if (ua) return -1
    if (ub) return 1
    return 0 // preservar orden original
  })

  return Response.json({
    categories: sorted,
    master: [...CATEGORIES_MASTER],
    plan: (profile?.plan as string | null) ?? 'free',
    giro: (profile?.giro as string | null) ?? null,
    seenAt: (profile?.categories_seen_at as string | null) ?? null,
    cap: USER_CATEGORIES_CAP,
  })
}

/**
 * POST /api/profile/categories
 *
 * Body: { categories: string[], markSeen?: boolean }
 *
 * Full-replace de la lista del user. Validaciones:
 *  - Cada item: string 1-40 chars no-vacío (vía isValidCategoryName)
 *  - Dedupe (case-insensitive: "Renta" === "renta")
 *  - Cap de USER_CATEGORIES_CAP totales (40)
 *  - Free: solo cats del master permitidas; custom strings → 403
 *  - Pro: cualquier mezcla de master + custom
 *
 * Si `markSeen=true` también setea `categories_seen_at = NOW()` (para que el
 * modal bloqueante no vuelva a aparecer).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body: { categories?: unknown; markSeen?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!Array.isArray(body.categories)) {
    return Response.json({ error: 'categories debe ser un array' }, { status: 400 })
  }

  // Dedupe case-insensitive, preservando el primer casing visto.
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const raw of body.categories) {
    if (!isValidCategoryName(raw)) continue
    const trimmed = (raw as string).trim()
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push(trimmed)
  }

  if (cleaned.length > USER_CATEGORIES_CAP) {
    return Response.json(
      { error: `Máximo ${USER_CATEGORIES_CAP} categorías`, code: 'CAP_EXCEEDED' },
      { status: 400 },
    )
  }

  // Pro-gate: identificar items custom (no en el master) y verificar plan.
  const masterSet = new Set<string>(CATEGORIES_MASTER)
  const customItems = cleaned.filter(c => !masterSet.has(c))

  if (customItems.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()
    if ((profile?.plan as string) !== 'pro') {
      return Response.json(
        {
          error: 'Las categorías personalizadas son una funcionalidad Pro.',
          code: 'PRO_REQUIRED',
          customItems,
        },
        { status: 403 },
      )
    }
  }

  const patch: Record<string, unknown> = { categories: cleaned }
  if (body.markSeen === true) {
    patch.categories_seen_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)

  if (error) {
    console.error('[POST /api/profile/categories]', error)
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  // Track — útil para entender adopción del nuevo flow + uso de custom.
  await trackServer(supabase, user.id, 'categories_updated', {
    count: cleaned.length,
    custom_count: customItems.length,
    marked_seen: body.markSeen === true,
  })

  return Response.json({ ok: true, categories: cleaned })
}
