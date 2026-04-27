'use client'

/**
 * Dropdown compacto de período para el card de métricas en /registros.
 *
 * 4 opciones fijas: Hoy / Semana / Este mes / Año. Reemplazó al FilterBox
 * con chips horizontales que tenía 5+ opciones (7 días, Histórico, custom
 * range Pro). El razonamiento es que en el card de "registros" lo que el user
 * quiere ver es resumen del período elegido, sin granularidad de día arbitrario
 * — para análisis profundo está `/reportes`.
 *
 * Acepta `period=today` (alimenta /api/reports/compare con today vs avg-30d).
 */

import { useEffect, useRef, useState } from 'react'
import { IconCalendar, IconCaretDown, IconCaretUp } from '@/components/icons'

export type RegistrosPeriod = 'today' | 'week' | 'month' | 'year'

const OPTIONS: Array<{ id: RegistrosPeriod; label: string }> = [
  { id: 'today',  label: 'Hoy'       },
  { id: 'week',   label: 'Semana'    },
  { id: 'month',  label: 'Este mes'  },
  { id: 'year',   label: 'Año'       },
]

export function periodDisplayLabel(period: RegistrosPeriod): string {
  // Lo que se muestra como "header" al lado de "Resumen" en el card.
  const now = new Date()
  switch (period) {
    case 'today':  return 'Hoy'
    case 'week':   return 'Esta semana'
    case 'month': {
      const m = now.toLocaleDateString('es-MX', { month: 'long' })
      return m.charAt(0).toUpperCase() + m.slice(1)
    }
    case 'year':   return String(now.getFullYear())
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

  const current = OPTIONS.find(o => o.id === value) ?? OPTIONS[2]

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
            minWidth: 130,
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
