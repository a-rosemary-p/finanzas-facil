import type { NextConfig } from 'next'

// ─── Content Security Policy ────────────────────────────────────────────────
// App Router SSR + Tailwind inyecta estilos inline → necesitamos 'unsafe-inline'
// en style-src. Next requiere 'unsafe-eval' para algunos runtime chunks. El
// resto se aprieta: connect limitado a Supabase/OpenAI/Stripe, frames solo de
// Stripe para 3DS, objects/base nulos, y frame-ancestors 'none' para clickjacking.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.stripe.com https://m.stripe.com https://r.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Microphone lo usa Web Speech API en EntryForm; cámara/geo no se usan.
    value: 'camera=(), geolocation=(), browsing-topics=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
