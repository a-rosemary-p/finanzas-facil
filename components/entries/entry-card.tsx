'use client'

import { formatCurrency, formatEntryDate } from '@/lib/utils'
import type { Movement } from '@/types'

interface MovementCardProps {
  movement: Movement
}

const TYPE_CONFIG = {
  ingreso: {
    label: 'Ingreso',
    bg: '#C8E6C9',
    color: '#1B5E20',
    border: '#A5D6A7',
    sign: '+',
  },
  gasto: {
    label: 'Gasto',
    bg: '#FFCDD2',
    color: '#B71C1C',
    border: '#EF9A9A',
    sign: '−',
  },
  pendiente: {
    label: 'Pendiente',
    bg: '#FFF8E1',
    color: '#E65100',
    border: '#FFE082',
    sign: '⏳ ',
  },
} as const

export function MovementCard({ movement }: MovementCardProps) {
  const cfg = TYPE_CONFIG[movement.type]

  return (
    <div
      className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3"
      style={{ border: '1px solid #E0E0E0' }}
    >
      {/* Badge de tipo — min-w basado en "Pendiente" (más largo), centrado */}
      <span
        className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[5rem] text-center"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>

      {/* Descripción + fecha */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: '#1A2B3A' }}>
          {movement.description}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#5A7A8A' }}>
          {formatEntryDate(movement.movementDate)}
        </p>
      </div>

      {/* Monto */}
      <span className="text-base font-bold shrink-0" style={{ color: cfg.color }}>
        {cfg.sign}{formatCurrency(movement.amount)}
      </span>
    </div>
  )
}
