'use client'

/**
 * Trackea `page_viewed` cada vez que cambia la ruta. Está montado en el ROOT
 * `app/layout.tsx` (v0.292) — antes vivía solo dentro de `(app)/layout.tsx`,
 * pero queríamos cubrir landing y login también para tener analytics propios
 * de la página entera (no solo post-login).
 *
 * Enriquecimiento client-side (v0.292):
 *  - `visitor_id`: UUID persistente en localStorage. Identifica un usuario
 *    único (a través de sesiones/devices del mismo browser).
 *  - `session_id`: UUID en sessionStorage. Una sesión = una pestaña abierta;
 *    sirve para contar bounces (sessions con un solo page_view).
 *  - `referrer`: document.referrer en primera carga, vacío después.
 *  - `utm_*`: utm_source, utm_medium, utm_campaign si vienen en query string.
 *
 * El country lo inyecta /api/track server-side (header `x-vercel-ip-country`),
 * y el device se parsea ahí también (de user-agent).
 *
 * Sigue siendo fire-and-forget: si el tracking falla, la UI no se entera.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'

const VISITOR_KEY = 'fz_visitor_id'
const SESSION_KEY = 'fz_session_id'

function readOrCreate(storage: Storage | null, key: string): string {
  if (!storage) return ''
  try {
    const existing = storage.getItem(key)
    if (existing) return existing
    const fresh = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    storage.setItem(key, fresh)
    return fresh
  } catch {
    return ''
  }
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null // private mode / storage disabled
  }
}

interface PageViewPayload {
  path: string
  visitor_id?: string
  session_id?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  is_first_in_session?: boolean
}

export function PageViewTracker() {
  const pathname = usePathname()
  // En el primer pageview de la sesión capturamos referrer + UTMs. Los
  // siguientes ya no tienen referrer real (queda vacío) y los UTMs solo
  // existen mientras la URL los conserve.
  const isFirstRef = useRef(true)

  useEffect(() => {
    if (!pathname) return

    const visitorId = readOrCreate(safeStorage('local'),   VISITOR_KEY)
    const sessionId = readOrCreate(safeStorage('session'), SESSION_KEY)

    const payload: PageViewPayload = {
      path: pathname,
      visitor_id: visitorId || undefined,
      session_id: sessionId || undefined,
    }

    if (isFirstRef.current) {
      payload.is_first_in_session = true
      const ref = (typeof document !== 'undefined' && document.referrer) || ''
      if (ref && typeof window !== 'undefined') {
        try {
          const refUrl = new URL(ref)
          // Excluye self-referrers (mismo origen) — no son referrers reales,
          // son navegaciones internas durante el primer paint.
          if (refUrl.origin !== window.location.origin) {
            payload.referrer = ref
          }
        } catch {
          // referrer no-URL, ignoramos
        }
      }
      try {
        const q = new URLSearchParams(window.location.search)
        const utmS = q.get('utm_source')
        const utmM = q.get('utm_medium')
        const utmC = q.get('utm_campaign')
        if (utmS) payload.utm_source   = utmS.slice(0, 80)
        if (utmM) payload.utm_medium   = utmM.slice(0, 80)
        if (utmC) payload.utm_campaign = utmC.slice(0, 80)
      } catch {
        // ignore
      }
      isFirstRef.current = false
    }

    track('page_viewed', payload as unknown as Record<string, unknown>)
  }, [pathname])

  return null
}
