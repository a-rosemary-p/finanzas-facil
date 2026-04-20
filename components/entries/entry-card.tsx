'use client'

import { useState } from 'react'
import { formatCurrency, formatEntryDate, getTodayString } from '@/lib/utils'
import { MOVEMENT_TYPES } from '@/lib/constants'
import type { Movement } from '@/types'

interface MovementCardProps {
  movement: Movement
  onUpdated: (updated: Movement) => void
  onDeleted: (id: string) => void
  hideDate?: boolean
}

const TYPE_CONFIG = {
  ingreso: {
    label: 'Ingreso',
    bg: 'var(--income-bg)',
    color: 'var(--income-text)',
    border: 'var(--income-border)',
    sign: '+',
  },
  gasto: {
    label: 'Gasto',
    bg: 'var(--expense-bg)',
    color: 'var(--expense-text)',
    border: 'var(--expense-border)',
    sign: '−',
  },
  pendiente: {
    label: 'Pendiente',
    bg: 'var(--pending-bg)',
    color: 'var(--pending-text)',
    border: 'var(--pending-border)',
    sign: '⏳ ',
  },
} as const

export function MovementCard({ movement, onUpdated, onDeleted, hideDate = false }: MovementCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const [editType, setEditType] = useState(movement.type)
  const [editDescription, setEditDescription] = useState(movement.description)
  const [editAmount, setEditAmount] = useState(String(movement.amount))
  const [editDate, setEditDate] = useState(movement.movementDate)
  const [editIsInvestment, setEditIsInvestment] = useState(movement.isInvestment)

  const cfg = TYPE_CONFIG[movement.type]
  const busy = saving || deleting
  const cardBorder = movement.isInvestment ? '1.5px solid var(--investment)' : '1px solid var(--brand-border)'

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
      const res = await fetch(`/api/movements/${movement.id}`, {
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
      const res = await fetch(`/api/movements/${movement.id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json() as { error?: string }; setError(data.error ?? 'Error al borrar'); return }
      onDeleted(movement.id)
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setDeleting(false) }
  }

  /* ── Modo edición ── */
  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3" style={{ border: '1px solid var(--brand-light)' }}>
        {/* Selector de tipo */}
        <div className="flex gap-2">
          {MOVEMENT_TYPES.map(t => {
            const tcfg = TYPE_CONFIG[t]
            const active = editType === t
            return (
              <button key={t} type="button" onClick={() => setEditType(t)} disabled={busy}
                className="flex-1 py-1.5 rounded-full text-xs font-bold border transition-colors"
                style={active
                  ? { background: tcfg.bg, color: tcfg.color, borderColor: tcfg.border }
                  : { background: 'var(--brand-chip)', color: 'var(--brand-muted)', borderColor: 'var(--brand-border)' }
                }
              >
                {tcfg.label}
              </button>
            )
          })}
        </div>

        <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
          placeholder="Descripción" maxLength={60} disabled={busy}
          className="border rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        />

        <div className="flex gap-2">
          <div className="flex-1 relative min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none" style={{ color: 'var(--brand-mid)' }}>$</span>
            <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
              placeholder="0" min="0.01" step="0.01" disabled={busy}
              className="border rounded-lg pl-7 pr-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            />
          </div>
          <input type="date" value={editDate} max={getTodayString()} onChange={e => setEditDate(e.target.value)}
            disabled={busy}
            className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 shrink-0"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)', width: '138px' }}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editIsInvestment} onChange={e => setEditIsInvestment(e.target.checked)}
            disabled={busy} className="w-4 h-4" style={{ accentColor: 'var(--investment)' }}
          />
          <span className="text-xs" style={{ color: 'var(--brand-mid)' }}>📈 Marcar como inversión (activo a largo plazo)</span>
        </label>

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={cancelEdit} disabled={busy}
            className="py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
          >
            Cancelar
          </button>
        </div>

        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy}
            className="w-full py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
          >
            Borrar movimiento
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={handleDelete} disabled={busy}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--danger)' }}
            >
              {deleting ? 'Borrando...' : '¿Confirmar borrado?'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}
              className="py-2 px-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
            >
              No
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── Vista normal ── */
  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3" style={{ border: cardBorder }}>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[5rem] text-center"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--brand)' }}>
          {movement.description}
        </p>
        {!hideDate && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-mid)' }}>{formatEntryDate(movement.movementDate)}</p>
        )}
      </div>

      {movement.isInvestment && (
        <span className="text-base shrink-0" title="Inversión">📈</span>
      )}

      <span className="text-base font-bold shrink-0" style={{ color: cfg.color }}>
        {cfg.sign}{formatCurrency(movement.amount)}
      </span>

      <button type="button" onClick={openEdit}
        className="shrink-0 p-1.5 rounded-lg transition-colors flex items-center justify-center"
        style={{ color: 'var(--brand-muted)', background: 'var(--brand-chip)' }}
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
