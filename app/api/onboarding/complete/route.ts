import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'

/**
 * POST /api/onboarding/complete
 *
 * Marca al user como "ya vio el onboarding". Llamado por el componente
 * Onboarding cuando termina el último paso o cuando le da Saltar.
 *
 * Idempotente — si ya estaba seteado, lo deja igual (UPDATE no falla, solo
 * actualiza el timestamp). El cliente usa el timestamp solo como flag
 * (truthy/null), no como dato relevante.
 *
 * Body opcional: { reason: 'completed'|'skipped', last_step?: string } —
 * usado solo para analytics, no afecta la persistencia.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Lee el motivo (best-effort) — sin body válido caemos a 'completed'.
  let reason: 'completed' | 'skipped' = 'completed'
  let lastStep: string | undefined
  try {
    const body = (await request.json()) as { reason?: unknown; last_step?: unknown }
    if (body?.reason === 'skipped') reason = 'skipped'
    if (typeof body?.last_step === 'string') lastStep = body.last_step.slice(0, 40)
  } catch {
    // body vacío o no-JSON — OK, defaults
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[POST /api/onboarding/complete]', error)
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  await trackServer(supabase, user.id, 'onboarding_finished', {
    reason,
    last_step: lastStep,
  })

  return Response.json({ ok: true })
}
