'use client'

import { formatCurrency, formatEntryDate } from '@/lib/utils'
import type { Movement } from '@/types'

interface PendingCommitmentsProps {
  movements: Movement[]
  onMarkAsPaid: (id: string) => Promise<unknown>
}

export function PendingCommitments({ movements, onMarkAsPaid }: PendingCommitmentsProps) {
  if (movements.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--brand-muted)' }}>
        Próximos compromisos
      </h3>

      <div className="flex flex-col gap-2">
        {movements.map(m => (
          <div
            key={m.id}
            className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
            style={{ border: '1px solid var(--brand-border)' }}
          >
            {/* Date pill */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 min-w-[3rem]"
              style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
              <span className="text-[10px] font-semibold leading-none" style={{ color: 'var(--brand-mid)' }}>
                {new Date(m.movementDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}
              </span>
              <span className="text-base font-bold leading-tight" style={{ color: 'var(--brand)' }}>
                {new Date(m.movementDate + 'T12:00:00').getDate()}
              </span>
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--brand)' }}>
                {m.description}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                {formatEntryDate(m.movementDate)}
              </p>
            </div>

            {/* Amount */}
            <span className="text-sm font-bold shrink-0" style={{ color: 'var(--danger)' }}>
              {formatCurrency(m.amount)}
            </span>

            {/* Mark as paid button */}
            <button
              type="button"
              onClick={() => onMarkAsPaid(m.id)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              Pagado
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
