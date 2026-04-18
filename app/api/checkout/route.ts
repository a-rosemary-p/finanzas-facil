import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_CONFIG } from '@/lib/stripe/config'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Get profile to check for existing Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, plan, email')
    .eq('id', user.id)
    .single()

  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'Ya tienes el plan Pro' }, { status: 400 })
  }

  const stripe = getStripe()
  const email = user.email ?? profile?.email ?? undefined

  // Reuse existing customer or create new one
  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    // Persist customer ID immediately so webhooks can match later
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_CONFIG.priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: STRIPE_CONFIG.successUrl,
    cancel_url: STRIPE_CONFIG.cancelUrl,
    locale: 'es',
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
