import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_CONFIG } from '@/lib/stripe/config'

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '') // trim + drop trailing slashes
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try { return new URL(withProtocol).origin } catch { return null }
}

// Nunca usamos `req.url` ni el header Host para construir la URL base.
// Un atacante podría enviar un Host spoofeado para que Stripe redirija
// a un dominio controlado por él tras checkout.
function getBaseUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) : null
  if (fromEnv) return fromEnv
  // Vercel inyecta estas dos variables; son de confianza (no vienen del request).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return null
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
    .select('stripe_customer_id, plan, email, trial_used')
    .eq('id', user.id)
    .single()

  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'Ya tienes el plan Pro' }, { status: 400 })
  }

  const stripe = getStripe()
  const email = user.email ?? profile?.email ?? undefined
  const base = getBaseUrl()
  if (!base) {
    console.error('[POST /api/checkout] No trusted base URL configured (NEXT_PUBLIC_APP_URL / VERCEL_*)')
    return NextResponse.json({ error: 'Configuración del sitio incompleta. Contacta soporte.' }, { status: 500 })
  }

  // Reutilizar customer existente o crear uno nuevo
  let customerId = profile?.stripe_customer_id as string | undefined

  try {
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

    const priceId = STRIPE_CONFIG.priceId
    if (!priceId) {
      console.error('[POST /api/checkout] STRIPE_PRICE_ID no configurado')
      return NextResponse.json({ error: 'Configuración de pago incompleta. Contacta soporte.' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        // Solo ofrecer trial si el usuario nunca lo ha usado (anti-abuse)
        ...(profile?.trial_used ? {} : { trial_period_days: 30 }),
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${base}/registros?upgraded=1`,
      cancel_url: `${base}/registros`,
      locale: 'es',
      metadata: { supabase_user_id: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string } | null)?.code
    const type = (err as { type?: string } | null)?.type
    console.error('[POST /api/checkout] Stripe error:', { msg, code, type })
    if (msg.includes('No such price') || msg.includes('No such product')) {
      return NextResponse.json({ error: 'Error de configuración de pago. Contacta soporte.' }, { status: 500 })
    }
    if (msg.includes('No such customer')) {
      return NextResponse.json({ error: 'Error con tu cuenta. Intenta de nuevo.' }, { status: 400 })
    }
    if (msg.toLowerCase().includes('not a valid url')) {
      return NextResponse.json({ error: 'Error de configuración del sitio. Contacta soporte.' }, { status: 500 })
    }
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' }, { status: 500 })
  }
}
