import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Use service-role client (bypasses RLS) so we can update any profile
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
  const { error } = await admin
    .from('profiles')
    .update(patch)
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('[webhook] updateProfileByCustomer error', error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // If no webhook secret configured, skip signature verification
  // (only safe in development — production must have it set)
  let event: Stripe.Event

  try {
    const stripe = getStripe()
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      // Dev-only: parse without verification
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[webhook] received event', { type: event.type, id: event.id })

  // Statuses that entitle the user to Pro features
  const PRO_STATUSES = new Set(['trialing', 'active', 'past_due'])
  // Statuses that revoke Pro access
  const FREE_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired'])

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        // Fetch subscription to get its real status (may be 'trialing' not 'active')
        let status: string = 'active'
        if (subscriptionId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subscriptionId)
            status = sub.status
          } catch (e) {
            console.error('[webhook] failed to retrieve subscription', e)
          }
        }

        console.log('[webhook] checkout.session.completed', { customerId, subscriptionId, status })
        await updateProfileByCustomer(customerId, {
          plan: PRO_STATUSES.has(status) ? 'pro' : 'free',
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
        })
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status

        console.log(`[webhook] ${event.type}`, { customerId, subId: subscription.id, status })

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
          // incomplete, paused, etc. — just record status, don't change plan
          await updateProfileByCustomer(customerId, { subscription_status: status })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.log('[webhook] invoice.payment_succeeded', { customerId })
        await updateProfileByCustomer(customerId, {
          plan: 'pro',
          subscription_status: 'active',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.log('[webhook] invoice.payment_failed', { customerId })
        await updateProfileByCustomer(customerId, {
          subscription_status: 'past_due',
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        console.log('[webhook] customer.subscription.deleted', { customerId })
        await updateProfileByCustomer(customerId, {
          plan: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        })
        break
      }

      default:
        console.log('[webhook] unhandled event type', event.type)
        break
    }
  } catch (err) {
    console.error(`[webhook] Handler error for ${event.type}`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
