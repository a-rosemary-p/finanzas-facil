'use client'

/**
 * AppHeader — header compartido por todas las páginas protegidas.
 *
 * Diseño v2:
 *  - Header sólido blanco que cubre desde y=0 incluyendo el safe-area-inset-top
 *    del status bar nativo.
 *  - Wave cutoff inferior: SVG blanco que sangra ~10px hacia el gradiente.
 *  - Plan badge (Pro/Free) y burger menu a la derecha.
 *  - El alert de pendientes vencidos vive sobrepuesto al botón hamburger
 *    (visible siempre) y duplicado en el item "Pendientes" del dropdown.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { usePendings } from '@/hooks/use-pendings'
import { IconList, IconLogout } from '@/components/icons'
import { WaveRule } from '@/components/ui/wave'

interface AppHeaderProps {
  /** Esconde el plan badge si lo necesitas (raro). Default: visible. */
  hidePlanBadge?: boolean
}

const MENU_ITEMS: Array<{ label: string; href: string }> = [
  { label: 'Inicio',      href: '/inicio'      },
  { label: 'Movimientos', href: '/movimientos' },
  { label: 'Pendientes',  href: '/pendientes'  },
  { label: 'Reportes',    href: '/reportes'    },
  { label: 'Perfil',      href: '/perfil'      },
  { label: 'Ajustes',     href: '/ajustes'     },
]

export function AppHeader({ hidePlanBadge = false }: AppHeaderProps) {
  const { profile, logout } = useAuth()
  const { overdueCount } = usePendings()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
      className="bg-white sticky top-0 flex items-center justify-between px-4 z-20 fz-app-header"
      // El header tapa el status bar nativo del móvil con su safe area.
      // Esto es comportamiento responsive imposible de expresar como class.
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
      }}
    >
      {/* Logo → /registros */}
      <Link href="/inicio" aria-label="Ir a Inicio">
        <img src="/logo-green.png" alt="fiza" className="h-8 w-auto block" />
      </Link>

      <div className="flex items-center gap-3">
        {!hidePlanBadge && profile && (
          <span
            className={[
              'text-sm font-medium px-3 py-2 rounded-full min-h-[44px] flex items-center border',
              isPro
                ? 'bg-brand text-white border-brand'
                : 'bg-brand-lime text-brand border-brand-light',
            ].join(' ')}
            aria-label={`Plan ${isPro ? 'Pro' : 'Base'}`}
          >
            {isPro ? 'Pro' : 'Base'}
          </span>
        )}

        {/* Menú hamburger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className={[
              'relative flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px] transition-colors border border-brand-border text-ink-700',
              menuOpen ? 'bg-brand-chip' : 'bg-transparent',
            ].join(' ')}
            aria-label={overdueCount > 0 ? `Menú · ${overdueCount} pendientes vencidos` : 'Menú'}
            aria-expanded={menuOpen}
          >
            <IconList size={22} />
            {overdueCount > 0 && (
              <span
                aria-hidden="true"
                className="fz-alert-badge"
              >
                {overdueCount > 9 ? '9+' : overdueCount}
              </span>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-fz-3 overflow-hidden border border-brand-border top-full z-50"
              role="menu"
            >
              {MENU_ITEMS.map(item => {
                const showDot = item.href === '/pendientes' && overdueCount > 0
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-brand-chip min-h-[48px] text-brand"
                    role="menuitem"
                  >
                    <span className="flex-1">{item.label}</span>
                    {showDot && (
                      <span aria-label={`${overdueCount} vencidos`} className="fz-menu-badge">
                        {overdueCount > 9 ? '9+' : overdueCount}
                      </span>
                    )}
                  </Link>
                )
              })}
              <WaveRule />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); logout() }}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full transition-colors hover:bg-danger-bg min-h-[48px] text-danger"
                role="menuitem"
              >
                <IconLogout size={15} />
                <span>Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Wave cutoff inferior — la altura y el bottom negativo son específicos
       * de este SVG, mejor mantenerlos como clase utilitaria de globals. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 390 12"
        preserveAspectRatio="none"
        className="fz-app-header__wave"
      >
        <path
          d="M 0 0 L 0 6 C 48 12, 97 0, 146 6 S 243 12, 292 6 S 350 2, 390 6 L 390 0 Z"
          fill="white"
        />
      </svg>
    </header>
  )
}
