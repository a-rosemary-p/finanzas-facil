'use client'

/**
 * AppHeader — header compartido por todas las páginas protegidas.
 *
 * Antes vivía inline en `dashboard`, `perfil`, `ajustes`, `reportes`. Cuatro
 * copias casi idénticas que divergían silenciosamente (ej: `reportes` no tenía
 * plan badge ni botón Salir). Centralizado para que un cambio se propague a
 * todas las páginas en una sola edición.
 *
 * Diseño v2 (handoff abr 2026):
 *  - Header sólido blanco que cubre desde y=0 incluyendo el safe-area-inset-top
 *    del status bar nativo (status bar de iOS/Android no se traslapa con el
 *    contenido, igual que antes).
 *  - Wave cutoff al fondo: SVG blanco que sangra ~10px hacia el gradiente.
 *    Reemplaza el `border-bottom` recto. Puramente estético.
 *  - Plan badge (Pro/Free) y burger menu a la derecha. Click outside cierra.
 *
 * Uso: `<AppHeader />` en cualquier página protegida. Sin props necesarios —
 * lee plan + logout de `useAuth()` por sí solo.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { IconList, IconLogout } from '@/components/icons'
import { WaveRule } from '@/components/ui/wave'

interface AppHeaderProps {
  /** Esconde el plan badge si lo necesitas (raro). Default: visible. */
  hidePlanBadge?: boolean
}

const MENU_ITEMS: Array<{ label: string; href: string }> = [
  { label: 'Registros', href: '/registros' },
  { label: 'Perfil', href: '/perfil' },
  { label: 'Ajustes', href: '/ajustes' },
  { label: 'Reportes', href: '/reportes' },
]

export function AppHeader({ hidePlanBadge = false }: AppHeaderProps) {
  const { profile, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al click fuera. Sin esto el dropdown queda abierto al
  // navegar a otra parte de la pantalla.
  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const isPro = profile?.plan === 'pro'

  return (
    <header
      className="bg-white sticky top-0 flex items-center justify-between px-4"
      style={{
        // El header tapa el status bar nativo del móvil con su safe area.
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        paddingBottom: '10px',
        minHeight: '56px',
        position: 'sticky',
        zIndex: 20,
      }}
    >
      {/* Logo → /registros (la pantalla "casa") */}
      <Link href="/registros" aria-label="Ir a Registros">
        <img src="/logo-green.png" alt="fiza" style={{ height: '32px', width: 'auto', display: 'block' }} />
      </Link>

      <div className="flex items-center gap-3">
        {/* Plan badge */}
        {!hidePlanBadge && profile && (
          <span
            className="text-sm font-medium px-3 py-2 rounded-full min-h-[44px] flex items-center"
            style={
              isPro
                ? { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)' }
                : { background: 'var(--brand-lime)', color: 'var(--brand)', border: '1px solid var(--brand-light)' }
            }
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
        )}

        {/* Menú hamburger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px] transition-colors"
            style={{
              background: menuOpen ? 'var(--brand-chip)' : 'transparent',
              border: '1px solid var(--brand-border)',
              color: 'var(--ink-700)',
            }}
            aria-label="Menú"
            aria-expanded={menuOpen}
          >
            <IconList size={22} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg overflow-hidden"
              style={{ border: '1px solid var(--brand-border)', top: '100%', zIndex: 50 }}
              role="menu"
            >
              {MENU_ITEMS.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--brand-chip)] min-h-[48px]"
                  style={{ color: 'var(--brand)' }}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              ))}
              <WaveRule />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); logout() }}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full transition-colors hover:bg-[var(--danger-bg)] min-h-[48px]"
                style={{ color: 'var(--danger)' }}
                role="menuitem"
              >
                <IconLogout size={15} />
                <span>Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Wave cutoff inferior — SVG blanco que sangra hacia el gradiente.
       * Reemplaza el border-bottom recto. Posicionado absoluto al bottom del
       * header con z-index > 0 para que aparezca sobre el contenido siguiente. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 390 12"
        preserveAspectRatio="none"
        style={{
          display: 'block',
          width: '100%',
          position: 'absolute',
          bottom: -10,
          left: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <path
          d="M 0 0 L 0 6 C 48 12, 97 0, 146 6 S 243 12, 292 6 S 350 2, 390 6 L 390 0 Z"
          fill="white"
        />
      </svg>
    </header>
  )
}
