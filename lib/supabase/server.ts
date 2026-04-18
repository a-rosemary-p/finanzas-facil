import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Crea un cliente Supabase para uso en Server Components y API routes.
// Llama await cookies() porque en Next.js 15+ cookies() es async.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll llamado desde un Server Component — se ignora.
            // El middleware se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}
