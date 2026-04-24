'use client'

// Wrapper de `fetch` para llamadas a /api/* que requieren sesión. Si la primera
// llamada regresa 401 ("No autenticado" del middleware), intenta refrescar la
// sesión de Supabase y reintenta UNA VEZ. Si aun así falla, devuelve la 401.
//
// Resuelve el caso clásico: el cliente tiene la página abierta rato, el JWT
// expiró, el auto-refresh de supabase-js no se ha disparado, el usuario hace
// click rápido. Antes: 401 visible al usuario → confusión. Ahora: invisible.

import { createClient } from '@/lib/supabase/client'

export async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const first = await fetch(input, init)
  if (first.status !== 401) return first

  // Intento de refresh — puede fallar si el refresh token también está muerto.
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.refreshSession()
    if (error) return first // devolvemos el 401 original, refresh genuinamente falló
  } catch {
    return first
  }

  // Retry con la misma config
  return fetch(input, init)
}
