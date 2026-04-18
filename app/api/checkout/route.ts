import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_CONFIG } from '@/lib/stripe/config'

function getBaseUrl(req: NextRequest): string {
  // 1. Env var explícita
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  // 2. Vercel inyecta VERCEL_PROJECT_PRODUCTION_URL = dominio de producción (sin https://)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  // 3. VERCEL_URL = URL del deploy específico (útil en preview)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // 4. Fallback local
  const { origin } = new URL(req.url)
  return origin
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Obtener perfil para verificar si ya es Pro o tiene customer_id
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
  const base = getBaseUrl(req)

  // Reutilizar customer existente o crear uno nuevo
  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    // Guardar el customer_id de inmediato para que el webhook lo encuentre
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
    success_url: `${base}/dashboard?upgraded=1`,
    cancel_url: `${base}/dashboard`,
    locale: 'es',
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
