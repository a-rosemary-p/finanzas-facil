import Stripe from 'stripe'

// Cliente Stripe server-side (nunca llega al browser)
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
    _stripe = new Stripe(key)
  }
  return _stripe
}
