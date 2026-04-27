import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try { return new URL(withProtocol).origin } catch { return null }
}

// Nunca confiar en req.url / Host: un Host spoofeado podría redirigir
// el portal de Stripe a un dominio atacante tras cambios de suscripción.
function getBaseUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) : null
  if (fromEnv) return fromEnv
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
  const base = getBaseUrl()
  if (!base) {
    console.error('[POST /api/portal] No trusted base URL configured')
    return NextResponse.json({ error: 'Configuración del sitio incompleta. Contacta soporte.' }, { status: 500 })
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/registros`,
    })
    return NextResponse.json({ url: portalSession.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/portal] Stripe error:', msg)
    if (msg.includes('No such customer')) {
      return NextResponse.json({ error: 'No se encontró tu suscripción. Intenta suscribirte de nuevo.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al abrir el portal. Intenta de nuevo.' }, { status: 500 })
  }
}
