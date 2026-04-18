'use client'

import { formatCurrency, formatEntryDate } from '@/lib/utils'
import type { Entry, Movement } from '@/types'

interface EntryCardProps {
  entry: Entry
}

function movementColor(type: Movement['type']): string {
  if (type === 'ingreso') return '#2E7D32'
  if (type === 'gasto') return '#C62828'
  return '#F57F17' // pendiente
}

function movementSign(type: Movement['type']): string {
  if (type === 'ingreso') return '+'
  if (type === 'gasto') return '−'
  return '⏳ '
}

export function EntryCard({ entry }: EntryCardProps) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2"
      style={{ border: '1px solid #E0E0E0' }}
    >
      {/* Texto original del usuario */}
      <p
        className="text-sm italic leading-snug line-clamp-2"
        style={{ color: '#5A7A8A' }}
      >
        "{entry.rawText}"
      </p>

      {/* Fecha */}
      <p className="text-xs" style={{ color: '#5A7A8A' }}>
        {formatEntryDate(entry.entryDate)}
      </p>

      {/* Movimientos */}
      <div className="flex flex-col gap-1 pt-1" style={{ borderTop: '1px solid #E0E0E0' }}>
        {entry.movements.length === 0 ? (
          <p className="text-xs" style={{ color: '#5A7A8A' }}>
            Sin movimientos
          </p>
        ) : (
          entry.movements.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: '#5A7A8A' }}>
                {m.description}
                <span
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: '#F0FAF4',
                    color: '#5A7A8A',
                  }}
                >
                  {m.category}
                </span>
              </span>
              <span
                className="text-sm font-bold shrink-0"
                style={{ color: movementColor(m.type) }}
              >
                {movementSign(m.type)}{formatCurrency(m.amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
