'use client'

/**
 * PendingRow — fila de un pendiente en /pendientes con modo edit inline.
 *
 * Estados:
 *  - view: pill de fecha + descripción + monto + botones (Pagar / Editar)
 *  - edit: form inline para cambiar monto/descripción/categoría/fecha + Guardar/Cancelar/Borrar
 *
 * El estado de edit vive local (no se mezcla con la lista). El componente
 * recibe callbacks para markAsPaid / updatePending / deletePending del hook
 * `usePendings`. Optimistic updates los maneja el hook, no este componente.
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { IconPencil } from '@/components/icons'
import type { Movement, Category } from '@/types'

interface Props {
  mov: Movement
  /** Si la fila está vencida (movement_date <= hoy), pinta el bg con tinte rojo. */
  overdue: boolean
  onMarkAsPaid: (id: string) => Promise<boolean> | boolean
  onUpdate: (
    id: string,
    patch: Partial<Pick<Movement, 'type' | 'amount' | 'description' | 'category' | 'movementDate' | 'isInvestment'>>
  ) => Promise<boolean> | boolean
  onDelete: (id: string) => Promise<boolean> | boolean
}

export function PendingRow({ mov, overdue, onMarkAsPaid, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    amount: mov.amount,
    description: mov.description,
    category: mov.category,
    movementDate: mov.movementDate,
  }))
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function startEdit() {
    setDraft({
      amount: mov.amount,
      description: mov.description,
      category: mov.category,
      movementDate: mov.movementDate,
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const ok = await onUpdate(mov.id, draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  async function handlePay() {
    setPaying(true)
    await onMarkAsPaid(mov.id)
    // Si el hook removió la fila tras éxito, este componente se desmonta.
    setPaying(false)
  }

  async function handleDelete() {
    await onDelete(mov.id)
  }

  const dueLabel = formatDueLabel(mov.movementDate)
  // Bg blanco para ambos (vencidos y próximos). El border rojo es la única
  // diferencia visual entre vencido y no vencido — preferencia del user
  // (antes había un tint rojo muy tenue que era más ruido que señal).
  const bgTint = 'white'
  const borderColor = overdue ? 'var(--expense-border)' : 'var(--brand-border)'

  if (!editing) {
    return (
      <div
        className="rounded-xl flex items-center gap-2.5 px-3 py-2.5"
        style={{ background: bgTint, border: `1px solid ${borderColor}`, boxShadow: 'var(--sh-1)' }}
      >
        {/* Pill de fecha */}
        <div
          className="flex flex-col items-center justify-center text-[10px] font-bold rounded-md flex-shrink-0"
          style={{
            background: overdue ? 'var(--expense-bg)' : 'var(--pending-bg)',
            border: `1px solid ${overdue ? 'var(--expense-border)' : 'var(--pending-border)'}`,
            color: overdue ? 'var(--expense-text)' : 'var(--pending-text)',
            padding: '4px 8px',
            minWidth: 50,
            lineHeight: 1.1,
          }}
        >
          <span className="uppercase">{dueLabel.line1}</span>
          <span style={{ fontSize: 11 }}>{dueLabel.line2}</span>
        </div>

        {/* Descripción + monto */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--ink-900)' }}>
            {mov.description}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-500)' }}>
            {mov.category}
          </div>
        </div>

        <span
          className="text-sm font-bold tabular-nums flex-shrink-0"
          style={{ color: 'var(--pending-text)' }}
        >
          {formatCurrency(mov.amount)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handlePay}
            disabled={paying}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: 'var(--brand)', color: '#fff', minHeight: 32 }}
          >
            {paying ? '…' : 'Pagar'}
          </button>
          <button
            type="button"
            onClick={startEdit}
            className="rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: 'transparent',
              color: 'var(--brand-mid)',
              minHeight: 32,
              minWidth: 32,
              border: '1px solid var(--brand-border)',
            }}
            aria-label="Editar"
          >
            <IconPencil size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ── Modo edición ─────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl flex flex-col gap-2 p-3"
      style={{ background: 'white', border: '1px solid var(--brand)', boxShadow: 'var(--sh-2)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-mid)' }}>
        Editar pendiente
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Monto</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.amount || ''}
            onChange={e => setDraft(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Fecha</span>
          <input
            type="date"
            value={draft.movementDate}
            onChange={e => setDraft(d => ({ ...d, movementDate: e.target.value }))}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Descripción</span>
        <input
          type="text"
          value={draft.description}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          maxLength={60}
          className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Categoría</span>
        <select
          value={draft.category}
          onChange={e => setDraft(d => ({ ...d, category: e.target.value as Category }))}
          className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between gap-2 mt-1">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-medium px-2.5 py-2 rounded-lg"
            style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', minHeight: 36 }}
          >
            Borrar
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs font-bold px-2.5 py-2 rounded-lg text-white"
              style={{ background: 'var(--danger)', minHeight: 36 }}
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium px-2.5 py-2 rounded-lg"
              style={{ color: 'var(--brand-mid)', minHeight: 36 }}
            >
              Cancelar
            </button>
          </div>
        )}
        <div className="flex gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium px-2.5 py-2 rounded-lg"
            style={{ color: 'var(--brand-mid)', minHeight: 36 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.description.trim() || draft.amount <= 0}
            className="text-xs font-bold px-3 py-2 rounded-lg text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--brand)', minHeight: 36 }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// "30 abr" / "Hoy" / "Mañana" / "12 may" — pill compacta para la fecha.
function formatDueLabel(ymd: string): { line1: string; line2: string } {
  const today = new Date()
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (ymd === todayYMD) return { line1: 'HOY', line2: '' }

  // Mañana
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowYMD = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (ymd === tomorrowYMD) return { line1: 'MAÑ', line2: '' }

  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return { line1: ymd, line2: '' }
  const date = new Date(y, m - 1, d)
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase().replace('.', '')
  return { line1: month, line2: String(d) }
}

