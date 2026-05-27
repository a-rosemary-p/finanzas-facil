/**
 * POST /api/profile/delete (v1.0)
 *
 * Elimina la cuenta del usuario autenticado y TODA su data en cascada.
 * Requisito de Google Play Store (data deletion mechanism in-app).
 *
 * Flujo:
 *  1. Verificar sesión del user (no service-role aún — el user debe estar logueado).
 *  2. Si tiene suscripción Stripe activa, cancelar al final del período actual
 *     (no immediately — el user ya pagó el período corriente, no le quitamos
 *     el acceso retroactivamente). Si falla, log + seguir. La sub queda
 *     huérfana en Stripe pero el customer no recibe acceso al app porque
 *     ya no existe el user.
 *  3. Usar service-role admin client para `auth.admin.deleteUser(uid)`. Esto
 *     dispara CASCADE en profiles → movements → projects → recurring_movements
 *     → entries → analytics_events → todo lo demás.
 *  4. Tracker analytics ANTES de borrar (el user.id ya no será válido después).
 *
 * Respuesta: 200 { deleted: true } | 401 | 500.
 * Después del 200, el cliente debe llamar a supabase.auth.signOut() y redirect.
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { trackServer } from '@/lib/analytics-server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const userId = user.id
  const userEmail = user.email ?? ''

  // 1. Cancelar suscripción Stripe si existe — fail-soft.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, plan, subscription_status')
      .eq('id', userId)
      .single()

    if (profile?.stripe_subscription_id && profile.subscription_status !== 'canceled') {
      const stripeKey = process.env.STRIPE_SECRET_KEY
      if (stripeKey) {
        // Cancelar al final del período actual — no le quitamos lo que pagó.
        const res = await fetch(
          `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'cancel_at_period_end=true',
          },
        )
        if (!res.ok) {
          console.error('[delete account] stripe cancel failed', res.status, await res.text())
        }
      }
    }
  } catch (err) {
    console.error('[delete account] stripe step threw', err)
    // No abortar — el delete del user es lo crítico.
  }

  // 2. Track ANTES de borrar (después userId deja de existir como referencia válida).
  await trackServer(supabase, userId, 'account_deleted', {
    email_domain: userEmail.split('@')[1] ?? null,
  })

  // 3. Service-role admin client para borrar de auth.users.
  // Cascade vía migración 028 borra profile + todas las tablas con FK a profiles/auth.users.
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) {
    console.error('[delete account] missing env vars')
    return Response.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
  }

  const admin = createAdminClient(adminUrl, adminKey)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)

  if (deleteErr) {
    console.error('[delete account] admin.deleteUser failed', deleteErr)
    return Response.json(
      { error: 'No se pudo eliminar la cuenta. Contacta soporte.' },
      { status: 500 },
    )
  }

  // 4. Cerrar sesión server-side (el client también debería llamar signOut después).
  try {
    await supabase.auth.signOut()
  } catch {
    // OK si falla — el user ya no existe, las cookies pierden validez igual.
  }

  return Response.json({ deleted: true })
}
