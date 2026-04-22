'use client'

import { useState } from 'react'
import { formatDateWithWeekday } from '@/lib/utils'
import { MovementCard } from './entry-card'
import type { Movement } from '@/types'

interface MovementDayGroupProps {
  date: string
  movements: Movement[]
  defaultExpanded?: boolean
  onUpdated: (updated: Movement) => void
  onDeleted: (id: string) => void
  onMarkAsPaid?: (id: string) => Promise<unknown>
}

export function MovementDayGroup({
  date, movements, defaultExpanded = true, onUpdated, onDeleted, onMarkAsPaid,
}: MovementDayGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full py-1 min-h-[36px]"
        aria-expanded={expanded}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--brand)' }}>
          {formatDateWithWeekday(date)}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full ml-2 shrink-0 flex items-center gap-1"
          style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
        >
          {movements.length}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="flex flex-col gap-2 pb-1">
            {movements.map(m => (
              <MovementCard key={m.id} movement={m} onUpdated={onUpdated} onDeleted={onDeleted} onMarkAsPaid={onMarkAsPaid} hideDate />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
