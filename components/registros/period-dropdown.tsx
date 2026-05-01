'use client'

/**
 * Dropdown compacto de período para el card de métricas en /registros.
 *
 * 5 opciones, en orden de granularidad descendente (más amplio → más estrecho):
 *   global   — historial completo del usuario, sin comparación
 *   year     — rolling últimos 365 días vs los 365 previos
 *   month    — rolling últimos 30 días vs los 30 previos
 *   week     — rolling últimos 7 días vs los 7 previos
 *   today    — solo hoy vs el promedio diario de los últimos 30
 *
 * El cambio clave vs la versión anterior: month/year/week NO son
 * "el mes calendario actual" sino ventanas rolling. Esto da una lectura
 * más estable día a día — un user no ve un salto raro al cambiar de mes.
 */

import { useEffect, useRef, useState } from 'react'
import { IconCalendar, IconCaretDown, IconCaretUp } from '@/components/icons'

export type RegistrosPeriod = 'global' | 'year' | 'month' | 'week' | 'today'

const OPTIONS: Array<{ id: RegistrosPeriod; label: string }> = [
  { id: 'global', label: 'Histórico'        },
  { id: 'year',   label: 'Último año'       },
  { id: 'month',  label: 'Últimos 30 días'  },
  { id: 'week',   label: 'Últimos 7 días'   },
  { id: 'today',  label: 'Hoy'              },
]

export function periodDisplayLabel(period: RegistrosPeriod): string {
  // Lo que se muestra como header al lado de "Resumen" en el card.
  switch (period) {
    case 'global': return 'Histórico'
    case 'year':   return 'Último año'
    case 'month':  return 'Últimos 30 días'
    case 'week':   return 'Últimos 7 días'
    case 'today':  return 'Hoy'
  }
}

interface Props {
  value: RegistrosPeriod
  onChange: (next: RegistrosPeriod) => void
}

export function PeriodDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const current = OPTIONS.find(o => o.id === value) ?? OPTIONS[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
        style={{
          background: 'var(--brand-chip)',
          border: '1px solid var(--brand-border)',
          color: 'var(--ink-700)',
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <IconCalendar size={14} style={{ color: 'var(--brand)' }} />
        {current.label}
        {open ? <IconCaretUp size={12} /> : <IconCaretDown size={12} />}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1 rounded-xl bg-white overflow-hidden"
          style={{
            border: '1px solid var(--brand-border)',
            boxShadow: 'var(--sh-3)',
            minWidth: 160,
            top: '110%',
            zIndex: 30,
          }}
        >
          {OPTIONS.map((opt, i) => {
            const active = opt.id === value
            return (
              <button
                key={opt.id}
                role="option"
                type="button"
                aria-selected={active}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className="block w-full text-left px-3.5 py-2.5 text-[13px] transition-colors hover:bg-[var(--brand-chip)]"
                style={{
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--brand)' : 'var(--ink-700)',
                  background: active ? 'var(--brand-chip)' : 'white',
                  borderTop: i > 0 ? '1px solid var(--brand-border)' : 'none',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
