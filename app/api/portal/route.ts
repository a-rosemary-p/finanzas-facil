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

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    return NextResponse.json({ error: 'Sin suscripción activa' }, { status: 400 })
  }

  const stripe = getStripe()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: STRIPE_CONFIG.portalReturnUrl,
  })

  return NextResponse.json({ url: portalSession.url })
}
