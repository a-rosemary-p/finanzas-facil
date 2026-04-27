/**
 * Helper compartido: dispara el flujo de upgrade a Pro.
 *
 * Antes había 3+ copias casi idénticas en `registros`, `ajustes`, `perfil`.
 * Otros lugares (trend-view, compare-view, hints en /reportes) usaban un
 * `<a href="/ajustes">` que rebotaba al user a otra página y le hacía dar un
 * click extra para llegar al checkout — UX innecesaria.
 *
 * Ahora todos los CTAs "Activa Pro / Actualizar a Pro" usan esta función:
 * un solo POST a `/api/checkout` y redirect a la URL de Stripe.
 *
 * El componente que llama maneja su propio loading state (no es global porque
 * varios botones pueden coexistir en una página).
 */

import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'

export async function startProCheckout(): Promise<void> {
  try {
    const res = await fetchWithAuthRetry('/api/checkout', { method: 'POST' })
    const data = (await res.json()) as { url?: string; error?: string }
    if (data.url) {
      window.location.href = data.url
      return
    }
    if (data.error) {
      window.alert(data.error)
      return
    }
    window.alert('No se pudo iniciar el checkout. Intenta de nuevo.')
  } catch {
    window.alert('No se pudo conectar. Intenta de nuevo.')
  }
}
