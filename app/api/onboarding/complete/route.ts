import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/onboarding/complete
 *
 * Marca al user como "ya vio el onboarding". Llamado por el componente
 * Onboarding cuando termina el último paso o cuando le da Saltar.
 *
 * Idempotente — si ya estaba seteado, lo deja igual (UPDATE no falla, solo
 * actualiza el timestamp). El cliente usa el timestamp solo como flag
 * (truthy/null), no como dato relevante.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[POST /api/onboarding/complete]', error)
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
