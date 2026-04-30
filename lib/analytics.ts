'use client'

/**
 * Cliente de analytics. Fire-and-forget: nunca bloquea ni rompe la UI
 * si la red falla o el endpoint cae.
 *
 * Eventos en uso:
 *  - report_exported  { format: 'pdf' | 'excel', period_slug, period_label }
 *  - onboarding_completed  { steps_seen?: number }
 *  - pending_paid  { days_until_due?: number, was_overdue: boolean }
 *
 * (Los eventos server-side — entry_created, recurring_created — se
 * insertan directo desde las API routes vía `lib/analytics-server.ts`.)
 *
 * Convención: snake_case en nombre del evento y en keys del payload,
 * para que las queries SQL no necesiten escaping.
 */

export function track(event: string, payload?: Record<string, unknown>) {
  // keepalive: el browser sigue mandando el request aunque el user
  // navegue/cierre la pestaña inmediatamente después de disparar el evento.
  // Sin esto, métricas como "report_exported" se perderían si el user
  // cierra el tab justo después de la descarga.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, payload: payload ?? {} }),
    keepalive: true,
  }).catch(() => {
    // Silencioso por diseño: tracking no debe romper UX.
  })
}
