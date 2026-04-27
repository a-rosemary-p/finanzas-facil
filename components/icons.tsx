/**
 * Inline SVG icons — set único para toda la app.
 *
 * Estilo: imitan los Phosphor Icons usados en el handoff de design (fill
 * variants para íconos protagonistas, regular outlines para utilitarios).
 * Mantenemos todo inline para no agregar dependencias (~100 KB de
 * `@phosphor-icons/react`) y conservar la regla "todo SVG inline" desde v0.21.
 *
 * Convenciones:
 *   - Default `size` = 22 (los protagonistas), 18 (utilitarios). Override por prop.
 *   - `currentColor` para todo. El padre controla color via `style` o `className`.
 *   - `aria-hidden="true"` por default (decorativos). Pasa `aria-label` para
 *      semántica si el ícono es la única señal visual del control.
 *
 * Si necesitas un ícono nuevo, agrégalo aquí — no en cada página.
 */

import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

function svgProps(p: IconProps, defaultSize = 22) {
  return {
    width: p.size ?? defaultSize,
    height: p.size ?? defaultSize,
    className: p.className,
    style: p.style,
    'aria-hidden': p['aria-label'] ? undefined : true,
    'aria-label': p['aria-label'],
    role: p['aria-label'] ? 'img' : undefined,
  }
}

/* ── Fill icons (protagonistas) ────────────────────────────────────────── */

export function IconWallet(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M21 7H5a1 1 0 0 1 0-2h14a1 1 0 1 0 0-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-4 9a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" />
    </svg>
  )
}

export function IconReceipt(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M20 2H4a1 1 0 0 0-.55 1.83L4 4.2v17.3a1 1 0 0 0 1.55.83L8 20.7l2.45 1.63a1 1 0 0 0 1.1 0L14 20.7l2.45 1.63a1 1 0 0 0 1.1 0L20 20.7l.55.37A1 1 0 0 0 22 20.2V3a1 1 0 0 0-1-1h-1zm-3 11H7a1 1 0 0 1 0-2h10a1 1 0 0 1 0 2zm0-4H7a1 1 0 0 1 0-2h10a1 1 0 0 1 0 2z" />
    </svg>
  )
}

export function IconChartPieSlice(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M21.92 11.6A10 10 0 0 0 12.4 2.08a1 1 0 0 0-1.07.94l-.33 7.81-7.81.33a1 1 0 0 0-.94 1.07A10 10 0 1 0 21.92 11.6zM13.43 4.16A8 8 0 0 1 19.84 10.57l-6.41.27.27-6.41z" />
    </svg>
  )
}

export function IconCamera(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M21 6h-3.17l-1.84-2.74A2 2 0 0 0 14.32 2.5H9.68a2 2 0 0 0-1.67.91L6.17 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM12 18.5a4.5 4.5 0 1 1 4.5-4.5 4.5 4.5 0 0 1-4.5 4.5z" />
    </svg>
  )
}

export function IconMicrophone(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zm7-4a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z" />
    </svg>
  )
}

export function IconPencil(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M21.71 5.63 18.37 2.29a1 1 0 0 0-1.41 0L3.29 15.96a1 1 0 0 0-.27.49l-1.5 6.5a1 1 0 0 0 1.21 1.21l6.5-1.5a1 1 0 0 0 .49-.27L21.71 7.04a1 1 0 0 0 0-1.41zm-13 14.78L4.6 21.4l.99-4.11 9.91-9.91 3.13 3.13z" />
    </svg>
  )
}

export function IconChatText(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...svgProps(p)}>
      <path d="M20 2H4a2 2 0 0 0-2 2v18a1 1 0 0 0 1.6.8L7.33 20H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-4 11H8a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2zm0-4H8a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2z" />
    </svg>
  )
}

/* ── Outline icons (utilitarios) ───────────────────────────────────────── */

export function IconCalendar(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...svgProps(p, 20)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  )
}

export function IconArrowRight(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...svgProps(p, 20)}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}

export function IconList(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...svgProps(p, 22)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function IconCaretDown(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...svgProps(p, 14)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconCaretUp(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...svgProps(p, 14)}>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}

/* ── Misc — usados fuera del handoff M3 (ya existían inline en otras
 * páginas, los movemos aquí para un solo lugar). ──────────────────────── */

export function IconLogout(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...svgProps(p, 16)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
