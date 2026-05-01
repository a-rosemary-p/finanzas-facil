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
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors bg-brand-chip border border-brand-border text-ink-700"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <IconCalendar size={14} className="text-brand" />
        {current.label}
        {open ? <IconCaretUp size={12} /> : <IconCaretDown size={12} />}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1 rounded-xl bg-white overflow-hidden border border-brand-border shadow-fz-3 min-w-[160px] top-[110%] z-30"
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
                className={[
                  'block w-full text-left px-3.5 py-2.5 text-[13px] transition-colors hover:bg-brand-chip',
                  active ? 'font-bold text-brand bg-brand-chip' : 'font-medium text-ink-700 bg-white',
                  i > 0 ? 'border-t border-brand-border' : '',
                ].join(' ')}
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
