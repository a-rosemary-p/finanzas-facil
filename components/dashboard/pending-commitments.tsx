'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Movement } from '@/types'

interface PendingCommitmentsProps {
  movements: Movement[]
  onMarkAsPaid: (id: string) => Promise<unknown>
}

export function PendingCommitments({ movements, onMarkAsPaid }: PendingCommitmentsProps) {
  const [expanded, setExpanded] = useState(false)

  if (movements.length === 0) return null

  return (
    <section>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full py-1 min-h-[36px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: expanded ? 'var(--pending-text)' : 'var(--brand-muted)' }}
          >
            Próximos compromisos
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--pending-bg)', color: 'var(--pending-text)', border: '1px solid var(--pending-border)' }}
          >
            {movements.length}
          </span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={expanded ? 'var(--pending-text)' : 'var(--brand-muted)'}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Divider — orange when expanded */}
      <div style={{ height: '1px', background: expanded ? 'var(--pending-border)' : 'var(--brand-light)', transition: 'background 0.2s ease' }} />

      {/* Collapsible content */}
      <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="flex flex-col gap-2 pt-2 pb-1">
            {movements.map(m => (
              <div
                key={m.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--pending-bg)', border: '1px solid var(--pending-border)' }}
              >
                {/* Date pill */}
                <div
                  className="shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 min-w-[2.8rem]"
                  style={{ background: '#fff', border: '1px solid var(--pending-border)' }}
                >
                  <span className="text-[10px] font-semibold leading-none uppercase" style={{ color: 'var(--pending-text)' }}>
                    {new Date(m.movementDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-base font-bold leading-tight" style={{ color: 'var(--pending-text)' }}>
                    {new Date(m.movementDate + 'T12:00:00').getDate()}
                  </span>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--brand)' }}>
                    {m.description}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--pending-text)' }}>
                    {formatCurrency(m.amount)}
                  </p>
                </div>

                {/* Mark as paid button — orange tenue */}
                <button
                  type="button"
                  onClick={() => onMarkAsPaid(m.id)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: '#fff',
                    color: 'var(--pending-text)',
                    border: '1px solid var(--pending-border)',
                  }}
                >
                  Pagado
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
