import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const { origin } = new URL(req.url)
  return origin
}

export async function POST(req: NextRequest) {
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
  const base = getBaseUrl(req)

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/dashboard`,
  })

  return NextResponse.json({ url: portalSession.url })
}
