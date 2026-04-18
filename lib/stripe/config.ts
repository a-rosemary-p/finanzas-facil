export const STRIPE_CONFIG = {
  priceId: process.env.STRIPE_PRICE_ID ?? '',
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  portalReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
}
