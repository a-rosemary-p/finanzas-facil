'use client'

/**
 * RecurringRow — fila de un recurrente.
 *
 * View: pill de tipo + descripción + monto + frecuencia + próxima fecha.
 * Edit: form inline para cambiar amount/description/category/frequency/
 * nextDueDate. Switch para pausar/reanudar. Borrar con confirm step.
 *
 * Editar el template NO afecta el pendiente actualmente materializado —
 * los cambios se aplican a las siguientes materializaciones.
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { IconPencil } from '@/components/icons'
import { getAppToday } from '@/lib/cdmx-date'
import type { RecurringMovement, Category, RecurringFrequency } from '@/types'

const FREQ_LABEL: Record<RecurringFrequency, string> = {
  week:  'cada semana',
  month: 'cada mes',
  year:  'cada año',
}

interface Props {
  rec: RecurringMovement
  onUpdate: (
    id: string,
    patch: Partial<{
      type: 'ingreso' | 'gasto'
      amount: number
      description: string
      category: string
      frequency: RecurringFrequency
      nextDueDate: string
      isActive: boolean
    }>,
  ) => Promise<boolean> | boolean
  onDelete: (id: string) => Promise<boolean> | boolean
}

export function RecurringRow({ rec, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState({
    amount: rec.amount,
    description: rec.description,
    category: rec.category as string,
    frequency: rec.frequency,
    nextDueDate: rec.nextDueDate,
  })
  const [saving, setSaving] = useState(false)

  const isIngreso = rec.type === 'ingreso'

  function startEdit() {
    setDraft({
      amount: rec.amount,
      description: rec.description,
      category: rec.category as string,
      frequency: rec.frequency,
      nextDueDate: rec.nextDueDate,
    })
    setConfirmDelete(false)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const ok = await onUpdate(rec.id, draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  async function togglePause() {
    await onUpdate(rec.id, { isActive: !rec.isActive })
  }

  if (!editing) {
    // El border se vuelve `brand-muted` y opacity 0.65 cuando está pausado.
    const rowBorder = rec.isActive ? 'border-brand-border' : 'border-brand-muted'
    const rowOpacity = rec.isActive ? '' : 'opacity-65'

    const pillClasses = isIngreso
      ? 'bg-income-bg border-income-border text-income-text'
      : 'bg-expense-bg border-expense-border text-expense-text'
    const amountColor = isIngreso ? 'text-income-text' : 'text-expense-text'

    return (
      <div className={`rounded-xl bg-white px-3 py-2.5 flex items-center gap-2.5 border shadow-fz-1 ${rowBorder} ${rowOpacity}`}>
        <span className={`text-[9px] font-bold uppercase rounded-md flex-shrink-0 px-[7px] py-1 tracking-[0.1em] border ${pillClasses}`}>
          {isIngreso ? 'Ingreso' : 'Gasto'}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-ink-900">
            {rec.description}
          </div>
          <div className="text-[11px] mt-0.5 text-ink-500">
            {FREQ_LABEL[rec.frequency]} · próximo {formatNextDue(rec.nextDueDate)}
            {!rec.isActive && <span className="italic"> · pausado</span>}
          </div>
        </div>

        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${amountColor}`}>
          {formatCurrency(rec.amount)}
        </span>

        <button
          type="button"
          onClick={startEdit}
          className="rounded-lg flex items-center justify-center transition-colors flex-shrink-0 bg-transparent text-brand-mid border border-brand-border min-h-[32px] min-w-[32px]"
          aria-label="Editar"
        >
          <IconPencil size={14} />
        </button>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  return (
    <div className="fz-card-active flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-brand-mid">
          Editar recurrente
        </span>
        <button
          type="button"
          onClick={togglePause}
          className={[
            'text-[11px] font-medium px-2.5 py-1 rounded-md border',
            rec.isActive
              ? 'bg-pending-bg text-pending-text border-pending-border'
              : 'bg-income-bg text-income-text border-income-border',
          ].join(' ')}
        >
          {rec.isActive ? 'Pausar' : 'Reanudar'}
        </button>
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
          <span className="fz-input-label">Próxima fecha</span>
          <input
            type="date"
            value={draft.nextDueDate}
            onChange={e => setDraft(d => ({ ...d, nextDueDate: e.target.value }))}
            className="fz-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="fz-input-label">Descripción</span>
        <input
          type="text"
          value={draft.description}
          maxLength={60}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          className="fz-input"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Categoría</span>
          <select
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value as Category }))}
            className="fz-input"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Frecuencia</span>
          <select
            value={draft.frequency}
            onChange={e => setDraft(d => ({ ...d, frequency: e.target.value as RecurringFrequency }))}
            className="fz-input"
          >
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
            <option value="year">Anual</option>
          </select>
        </label>
      </div>

      <p className="text-[11px] mt-1 leading-relaxed text-ink-500">
        Los cambios afectan los próximos pendientes generados. El que ya está activo no se modifica.
      </p>

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
              onClick={() => onDelete(rec.id)}
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

function formatNextDue(ymd: string): string {
  const todayYMD = getAppToday()
  if (ymd === todayYMD) return 'hoy'

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowYMD = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (ymd === tomorrowYMD) return 'mañana'

  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
