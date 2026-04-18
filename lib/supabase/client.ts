import { createBrowserClient } from '@supabase/ssr'

// Singleton para el browser — reutiliza la misma instancia en toda la app
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
