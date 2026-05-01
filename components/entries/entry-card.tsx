'use client'

import { useState } from 'react'
import { formatCurrency, formatEntryDate, getTodayString } from '@/lib/utils'
import { MOVEMENT_TYPES, MOVEMENT_TYPE_CONFIG } from '@/lib/constants'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { Movement } from '@/types'

// Maps de clases por tipo — alternativa a los strings var() de
// MOVEMENT_TYPE_CONFIG. Mismo color, ahora consumible como className.
const TYPE_CHIP: Record<Movement['type'], string> = {
  ingreso:   'bg-income-bg text-income-text border-income-border',
  gasto:     'bg-expense-bg text-expense-text border-expense-border',
  pendiente: 'bg-pending-bg text-pending-text border-pending-border',
}
const TYPE_AMOUNT_COLOR: Record<Movement['type'], string> = {
  ingreso:   'text-income-text',
  gasto:     'text-expense-text',
  pendiente: 'text-pending-text',
}

interface MovementCardProps {
  movement: Movement
  onUpdated: (updated: Movement) => void
  onDeleted: (id: string) => void
  onMarkAsPaid?: (id: string) => Promise<unknown>
  hideDate?: boolean
}

export function MovementCard({ movement, onUpdated, onDeleted, onMarkAsPaid, hideDate = false }: MovementCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const [editType, setEditType] = useState(movement.type)
  const [editDescription, setEditDescription] = useState(movement.description)
  const [editAmount, setEditAmount] = useState(String(movement.amount))
  const [editDate, setEditDate] = useState(movement.movementDate)
  const [editIsInvestment, setEditIsInvestment] = useState(movement.isInvestment)

  const cfg = MOVEMENT_TYPE_CONFIG[movement.type]
  const busy = saving || deleting || markingPaid

  function openEdit() {
    setEditType(movement.type)
    setEditDescription(movement.description)
    setEditAmount(String(movement.amount))
    setEditDate(movement.movementDate)
    setEditIsInvestment(movement.isInvestment)
    setError(''); setConfirmDelete(false); setEditing(true)
  }

  function cancelEdit() { setEditing(false); setError(''); setConfirmDelete(false) }

  async function handleSave() {
    const amountNum = parseFloat(editAmount.replace(',', '.'))
    if (!editDescription.trim()) { setError('Escribe una descripción'); return }
    if (isNaN(amountNum) || amountNum <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/movements/${movement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: editType, amount: amountNum, description: editDescription.trim(), movementDate: editDate, isInvestment: editIsInvestment }),
      })
      const data = await res.json() as { movement?: Movement; error?: string }
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      onUpdated(data.movement!); setEditing(false)
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/movements/${movement.id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json() as { error?: string }; setError(data.error ?? 'Error al borrar'); return }
      onDeleted(movement.id)
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setDeleting(false) }
  }

  /* ── Modo edición ── */
  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3 border border-brand-light">
        {/* Selector de tipo */}
        <div className="flex gap-2">
          {MOVEMENT_TYPES.map(t => {
            const active = editType === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setEditType(t)}
                disabled={busy}
                className={[
                  'flex-1 py-1.5 rounded-full text-xs font-bold border transition-colors',
                  active
                    ? TYPE_CHIP[t]
                    : 'bg-brand-chip text-brand-muted border-brand-border',
                ].join(' ')}
              >
                {MOVEMENT_TYPE_CONFIG[t].label}
              </button>
            )
          })}
        </div>

        <input
          type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
          placeholder="Descripción" maxLength={60} disabled={busy}
          className="border border-brand-border rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 text-brand"
        />

        <div className="flex gap-2">
          <div className="flex-1 relative min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none text-brand-mid">$</span>
            <input
              type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
              placeholder="0" min="0.01" step="0.01" disabled={busy}
              className="border border-brand-border rounded-lg pl-7 pr-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 text-brand"
            />
          </div>
          <input
            type="date" value={editDate} max={getTodayString()} onChange={e => setEditDate(e.target.value)}
            disabled={busy}
            className="border border-brand-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 shrink-0 text-brand w-[138px]"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={editIsInvestment} onChange={e => setEditIsInvestment(e.target.checked)}
            disabled={busy} className="w-4 h-4 fz-investment-check"
          />
          <span className="text-xs text-brand-mid">Marcar como inversión (activo a largo plazo)</span>
        </label>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button" onClick={handleSave} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 bg-brand"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button" onClick={cancelEdit} disabled={busy}
            className="py-2.5 px-4 rounded-xl text-sm font-medium border border-brand-border bg-brand-chip text-brand-mid transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

        {!confirmDelete ? (
          <button
            type="button" onClick={() => setConfirmDelete(true)} disabled={busy}
            className="w-full py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50 text-danger bg-danger-bg border border-danger-border"
          >
            Borrar movimiento
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button" onClick={handleDelete} disabled={busy}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 bg-danger"
            >
              {deleting ? 'Borrando...' : '¿Confirmar borrado?'}
            </button>
            <button
              type="button" onClick={() => setConfirmDelete(false)} disabled={busy}
              className="py-2 px-3 rounded-xl text-sm font-medium border border-brand-border bg-brand-chip text-brand-mid transition-colors disabled:opacity-50"
            >
              No
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── Vista normal ── */
  // Investment border es 1.5px y reemplaza el border-brand-border default;
  // Tailwind no genera 1.5px stock — usamos clase utilitaria propia.
  const cardBorderClass = movement.isInvestment ? 'fz-card-investment' : 'border border-brand-border'

  return (
    <div className={`bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 ${cardBorderClass}`}>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[5rem] text-center border ${TYPE_CHIP[movement.type]}`}>
        {cfg.label}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate text-brand">
          {movement.description}
        </p>
        {!hideDate && (
          <p className="text-xs mt-0.5 text-brand-mid">
            {formatEntryDate(movement.movementDate)}
            {movement.paidAt && movement.originalType === 'pendiente' && (
              <span className="ml-1.5 italic text-brand-muted">
                · era pendiente
              </span>
            )}
          </p>
        )}
      </div>

      {movement.isInvestment && (
        <span className="shrink-0 text-investment" title="Inversión">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
        </span>
      )}

      <span className={`text-base font-bold shrink-0 ${TYPE_AMOUNT_COLOR[movement.type]}`}>
        {cfg.sign}{formatCurrency(movement.amount)}
      </span>

      {movement.type === 'pendiente' && onMarkAsPaid && (
        <button
          type="button"
          onClick={async () => { setMarkingPaid(true); await onMarkAsPaid(movement.id); setMarkingPaid(false) }}
          disabled={busy}
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50 bg-brand text-white"
          aria-label="Marcar como pagado"
        >
          {markingPaid ? '...' : 'Pagado'}
        </button>
      )}

      <button
        type="button" onClick={openEdit}
        className="shrink-0 p-1.5 rounded-lg transition-colors flex items-center justify-center text-brand-muted bg-brand-chip"
        aria-label="Editar movimiento"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  )
}
