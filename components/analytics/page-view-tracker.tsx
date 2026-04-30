'use client'

/**
 * Trackea `page_viewed` cada vez que cambia la ruta dentro de la app
 * autenticada. Montado una vez en `(app)/layout.tsx` para cubrir todas
 * las páginas protegidas (registros, pendientes, reportes, perfil, ajustes)
 * sin tocar cada una.
 *
 * Notas:
 *  - Solo cuenta si hay sesión (el endpoint /api/track ignora si no hay user).
 *  - usePathname() es estable: no dispara dos veces para la misma ruta.
 *  - Sin dependencia de profile loading — tracking no debe bloquear UI.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'

export function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    track('page_viewed', { path: pathname })
  }, [pathname])

  return null
}
