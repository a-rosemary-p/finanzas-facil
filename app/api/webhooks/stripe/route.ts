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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        await updateProfileByCustomer(customerId, {
          plan: 'pro',
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        // Renewal — keep plan active
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

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status // active | past_due | canceled | ...

        if (status === 'active') {
          await updateProfileByCustomer(customerId, {
            plan: 'pro',
            subscription_status: 'active',
          })
        } else if (status === 'canceled' || status === 'unpaid') {
          await updateProfileByCustomer(customerId, {
            plan: 'free',
            subscription_status: status,
            stripe_subscription_id: null,
          })
        }
        break
      }

      default:
        // Unhandled event — return 200 so Stripe doesn't retry
        break
    }
  } catch (err) {
    console.error(`[webhook] Handler error for ${event.type}`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
