'use client'

/**
 * PendingRow — fila de un pendiente en /pendientes con modo edit inline.
 *
 * Estados:
 *  - view: pill de fecha + descripción + monto + botones (Pagar / Editar)
 *  - edit: form inline para cambiar monto/descripción/categoría/fecha + Guardar/Cancelar/Borrar
 *
 * El estado de edit vive local. Optimistic updates los maneja el hook
 * `usePendings`, no este componente.
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { IconPencil } from '@/components/icons'
import { getAppToday } from '@/lib/cdmx-date'
import type { Movement, Category } from '@/types'

interface Props {
  mov: Movement
  /** Si la fila está vencida, cambia el border a rojo y el tinte de la pill. */
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
    setPaying(false)
  }

  async function handleDelete() {
    await onDelete(mov.id)
  }

  const dueLabel = formatDueLabel(mov.movementDate)
  // Bg blanco siempre. El border rojo (`fz-row-overdue`) es la única diferencia
  // entre vencido y no vencido — preferencia del user (antes había un tint
  // rojo muy tenue que era más ruido que señal).
  const rowClasses = overdue
    ? 'bg-white border border-expense-border shadow-fz-1 rounded-xl flex items-center gap-2.5 px-3 py-2.5'
    : 'bg-white border border-brand-border shadow-fz-1 rounded-xl flex items-center gap-2.5 px-3 py-2.5'

  // Pill de fecha — colores cambian con overdue.
  const pillClasses = overdue
    ? 'bg-expense-bg border border-expense-border text-expense-text'
    : 'bg-pending-bg border border-pending-border text-pending-text'

  if (!editing) {
    return (
      <div className={rowClasses}>
        {/* Pill de fecha */}
        <div className={`flex flex-col items-center justify-center text-[10px] font-bold rounded-md flex-shrink-0 px-2 py-1 min-w-[50px] leading-[1.1] ${pillClasses}`}>
          <span className="uppercase">{dueLabel.line1}</span>
          {dueLabel.line2 && <span className="text-[11px]">{dueLabel.line2}</span>}
        </div>

        {/* Descripción + monto */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-ink-900">
            {mov.description}
          </div>
          <div className="text-[11px] mt-0.5 text-ink-500">
            {mov.category}
          </div>
        </div>

        <span className="text-sm font-bold tabular-nums flex-shrink-0 text-pending-text">
          {formatCurrency(mov.amount)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handlePay}
            disabled={paying}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-opacity disabled:opacity-50 bg-brand text-white min-h-[32px]"
          >
            {paying ? '…' : 'Pagar'}
          </button>
          <button
            type="button"
            onClick={startEdit}
            className="rounded-lg flex items-center justify-center transition-colors bg-transparent text-brand-mid border border-brand-border min-h-[32px] min-w-[32px]"
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
    <div className="fz-card-active flex flex-col gap-2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mid">
        Editar pendiente
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Monto</span>
          <input
            type="number" min="0" step="0.01"
            value={draft.amount || ''}
            onChange={e => setDraft(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))}
            className="fz-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Fecha</span>
          <input
            type="date"
            value={draft.movementDate}
            onChange={e => setDraft(d => ({ ...d, movementDate: e.target.value }))}
            className="fz-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="fz-input-label">Descripción</span>
        <input
          type="text"
          value={draft.description}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          maxLength={60}
          className="fz-input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="fz-input-label">Categoría</span>
        <select
          value={draft.category}
          onChange={e => setDraft(d => ({ ...d, category: e.target.value as Category }))}
          className="fz-input"
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
            className="fz-btn-danger-soft"
          >
            Borrar
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleDelete}
              className="fz-btn-danger"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="fz-btn-ghost"
            >
              Cancelar
            </button>
          </div>
        )}
        <div className="flex gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="fz-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.description.trim() || draft.amount <= 0}
            className="fz-btn-primary"
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
  const todayYMD = getAppToday()
  if (ymd === todayYMD) return { line1: 'HOY', line2: '' }

  const today = new Date()
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
