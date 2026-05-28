'use client'

/**
 * useIsStandalone (v1.0.2) — detecta cuando la app corre en modo standalone:
 *  - TWA en Android (Play Store) — display-mode: standalone
 *  - PWA instalada en desktop/mobile — display-mode: standalone
 *  - Web normal en browser → false
 *
 * Útil para esconder elementos que no aplican cuando la app está
 * "instalada" (ej. botón "Comentarios" durante testing del .aab en
 * Play Store — los testers usan el form oficial de Google).
 *
 * SSR-safe: durante el render del servidor devuelve false; en el primer
 * effect del cliente actualiza al valor real. Esto puede causar un
 * micro-flash pero es aceptable para UI no-crítico.
 */

import { useEffect, useState } from 'react'

export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(display-mode: standalone)')
    setStandalone(mq.matches)
    // Suscribirse a cambios (raro pero posible si el user instala mientras
    // tiene la pestaña abierta).
    const handler = (e: MediaQueryListEvent) => setStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return standalone
}
