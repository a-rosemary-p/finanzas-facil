import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Allow-list de paths válidos para el param `next`. Sin esto, un atacante
// puede phishear con `/auth/confirm?next=https://evil.com` y el usuario que
// apenas confirmó su correo termina en el dominio atacante.
const ALLOWED_NEXT_PATHS = new Set([
  '/dashboard',
  '/perfil',
  '/ajustes',
  '/reportes',
  '/reset-password',
])

function safeNext(raw: string | null): string {
  const fallback = '/dashboard'
  if (!raw) return fallback
  // Rechaza cualquier cosa que no sea un path absoluto interno sin escapes
  if (!raw.startsWith('/')) return fallback       // relative / external
  if (raw.startsWith('//')) return fallback       // protocol-relative URL
  if (raw.includes('\\')) return fallback         // backslash trick
  if (raw.includes('\u0000') || raw.includes('\r') || raw.includes('\n')) return fallback
  // Quédate con el path sin query/hash para comparar contra la allow-list
  const pathOnly = raw.split(/[?#]/)[0]
  return ALLOWED_NEXT_PATHS.has(pathOnly) ? raw : fallback
}

// Maneja el intercambio de código PKCE de Supabase (confirmación de email, recuperación de contraseña, etc.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectTo = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      const redirectTo = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Si hubo error, manda al login con mensaje
  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
