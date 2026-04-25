import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Service-role client — bypasea RLS para poder actualizar cualquier profile.
function getAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function updateProfileByCustomer(
  customerId: string,
  patch: Record<string, unknown>
) {
  const admin = getAdmin()
  const nowIso = new Date().toISOString()

  // ── 1) Camino feliz: matchea por stripe_customer_id ──────────────────
  // Usamos .select('id') para saber cuántas filas matcheó. Sin esto, una
  // ausencia de fila se ve como éxito silencioso.
  const { data, error } = await admin
    .from('profiles')
    .update({ ...patch, updated_at: nowIso })
    .eq('stripe_customer_id', customerId)
    .select('id')

  if (error) {
    console.error('[webhook] updateProfileByCustomer error', error)
    throw error
  }

  if (data && data.length > 0) return // Match feliz, listo

  // ── 2) Fallback: busca por metadata.supabase_user_id en Stripe ────────
  // Caso común: /api/checkout creó el customer pero la write del
  // stripe_customer_id en `profiles` falló o se hizo en otra fila por
  // alguna razón. Sin este fallback, el UPDATE afectaría 0 filas y el user
  // pagaría sin recibir Pro.
  console.warn('[webhook] no profile matched stripe_customer_id, trying metadata fallback', { customerId })

  try {
    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      console.error('[webhook] customer está deleted en Stripe', { customerId })
      return
    }
    const userId = (customer as Stripe.Customer).metadata?.supabase_user_id
    if (!userId) {
      console.error('[webhook] customer sin supabase_user_id en metadata', { customerId })
      return
    }

    // Update por user.id + backfill del stripe_customer_id para que
    // futuros eventos maticheen directo sin necesidad del fallback.
    const { error: fbErr, data: fbData } = await admin
      .from('profiles')
      .update({ ...patch, stripe_customer_id: customerId, updated_at: nowIso })
      .eq('id', userId)
      .select('id')
    if (fbErr) {
      console.error('[webhook] metadata fallback update error', fbErr)
      return
    }
    if (fbData && fbData.length > 0) {
      console.log('[webhook] recovered via metadata fallback', { customerId, userId })
    } else {
      console.error('[webhook] metadata fallback: profiles row not found for user_id', { customerId, userId })
    }
  } catch (err) {
    console.error('[webhook] metadata fallback threw', err)
    // No re-throw: el evento ya está claimed en stripe_events, no podemos
    // re-procesar. Mejor dejar que termine y que el operador limpie a mano
    // viendo los logs.
  }
}

// Intenta registrar el event.id. Devuelve `true` si este es el primer
// procesamiento, `false` si ya lo vimos antes (replay).
async function claimEventId(eventId: string, eventType: string): Promise<boolean> {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('stripe_events')
    .insert({ event_id: eventId, event_type: eventType })
    .select('event_id')
    .maybeSingle()

  if (error) {
    // Violation de unique PK → ya procesado
    if (error.code === '23505') return false
    console.error('[webhook] claimEventId error', error)
    throw error
  }
  return data != null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // Fail closed: sin secret configurado NO procesamos nada. En dev, usa
  // `stripe listen --forward-to ...` que provee el secret dinámicamente.
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET no está configurado')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotencia: Stripe a veces reenvía eventos (timeouts, reintentos).
  // Reentregar `checkout.session.completed` podría reactivar un sub cancelado.
  const firstTime = await claimEventId(event.id, event.type)
  if (!firstTime) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Statuses que habilitan Pro
  const PRO_STATUSES = new Set(['trialing', 'active', 'past_due'])
  // Statuses que revocan Pro
  const FREE_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired'])

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        // Trae la subscription real para conocer status y si tiene trial activo.
        let status: string = 'active'
        let hasTrial = false
        if (subscriptionId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subscriptionId)
            status = sub.status
            hasTrial = sub.status === 'trialing' || sub.trial_start != null
          } catch (e) {
            console.error('[webhook] failed to retrieve subscription', e)
          }
        }

        // Solo "quemamos" el trial si la sub efectivamente entró a trialing.
        // Un checkout fallido o sin trial no debe bloquear el trial futuro.
        const patch: Record<string, unknown> = {
          plan: PRO_STATUSES.has(status) ? 'pro' : 'free',
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
        }
        if (hasTrial) patch.trial_used = true

        await updateProfileByCustomer(customerId, patch)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status

        if (PRO_STATUSES.has(status)) {
          await updateProfileByCustomer(customerId, {
            plan: 'pro',
            stripe_subscription_id: subscription.id,
            subscription_status: status,
          })
        } else if (FREE_STATUSES.has(status)) {
          await updateProfileByCustomer(customerId, {
            plan: 'free',
            subscription_status: status,
            stripe_subscription_id: null,
          })
        } else {
          // incomplete, paused, etc. — solo registra status, no toca plan
          await updateProfileByCustomer(customerId, { subscription_status: status })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await updateProfileByCustomer(customerId, {
          plan: 'pro',
          subscription_status: 'active',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await updateProfileByCustomer(customerId, {
          subscription_status: 'past_due',
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        await updateProfileByCustomer(customerId, {
          plan: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        })
        break
      }

      default:
        // Evento no relevante — no loguear en happy path para no ruidear.
        break
    }
  } catch (err) {
    console.error(`[webhook] Handler error for ${event.type}`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
