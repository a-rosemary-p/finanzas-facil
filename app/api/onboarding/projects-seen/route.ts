/**
 * POST /api/onboarding/projects-seen (v0.5)
 *
 * Marca que el user vio el modal de onboarding del feature de Proyectos
 * (setea profiles.projects_onboarded_at = NOW()). Idempotente — si ya está
 * marcado, no-op.
 *
 * No requiere Pro gate per-se (un Free podría llamarlo y no rompe nada),
 * pero solo los Pros ven el modal así que en la práctica es Pro-only.
 */

import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ projects_onboarded_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('projects_onboarded_at', null)   // idempotente — no sobrescribir si ya existía

  if (error) {
    console.error('[POST /api/onboarding/projects-seen]', error)
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  await trackServer(supabase, user.id, 'projects_onboarding_completed', {})

  return Response.json({ ok: true })
}
