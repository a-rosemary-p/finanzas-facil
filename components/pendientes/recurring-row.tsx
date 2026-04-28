'use client'

/**
 * RecurringRow — fila de un recurrente en /pendientes tab Recurrentes.
 *
 * View mode: pill de tipo + descripción + monto + frecuencia + próxima fecha.
 * Edit mode: form inline para cambiar amount/description/category/frequency/
 * nextDueDate. Switch para pausar/reanudar. Borrar con confirm step.
 *
 * Editar el template NO afecta el pendiente actualmente materializado —
 * los cambios se aplican a las siguientes materializaciones.
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { IconPencil } from '@/components/icons'
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
  const cfg = isIngreso
    ? { bg: 'var(--income-bg)', text: 'var(--income-text)', border: 'var(--income-border)', label: 'Ingreso' }
    : { bg: 'var(--expense-bg)', text: 'var(--expense-text)', border: 'var(--expense-border)', label: 'Gasto' }

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
    return (
      <div
        className="rounded-xl bg-white px-3 py-2.5 flex items-center gap-2.5"
        style={{
          border: `1px solid ${rec.isActive ? 'var(--brand-border)' : 'var(--brand-muted)'}`,
          boxShadow: 'var(--sh-1)',
          opacity: rec.isActive ? 1 : 0.65,
        }}
      >
        <span
          className="text-[9px] font-bold uppercase rounded-md flex-shrink-0"
          style={{
            letterSpacing: '0.1em',
            padding: '4px 7px',
            background: cfg.bg,
            color: cfg.text,
            border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--ink-900)' }}>
            {rec.description}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-500)' }}>
            {FREQ_LABEL[rec.frequency]} · próximo {formatNextDue(rec.nextDueDate)}
            {!rec.isActive && <span className="italic"> · pausado</span>}
          </div>
        </div>

        <span
          className="text-sm font-bold tabular-nums flex-shrink-0"
          style={{ color: cfg.text }}
        >
          {formatCurrency(rec.amount)}
        </span>

        <button
          type="button"
          onClick={startEdit}
          className="rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
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
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl bg-white p-3 flex flex-col gap-2"
      style={{ border: '1px solid var(--brand)', boxShadow: 'var(--sh-2)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-mid)' }}>
          Editar recurrente
        </span>
        <button
          type="button"
          onClick={togglePause}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md"
          style={{
            background: rec.isActive ? 'var(--pending-bg)' : 'var(--income-bg)',
            color: rec.isActive ? 'var(--pending-text)' : 'var(--income-text)',
            border: `1px solid ${rec.isActive ? 'var(--pending-border)' : 'var(--income-border)'}`,
          }}
        >
          {rec.isActive ? 'Pausar' : 'Reanudar'}
        </button>
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
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Próxima fecha</span>
          <input
            type="date"
            value={draft.nextDueDate}
            onChange={e => setDraft(d => ({ ...d, nextDueDate: e.target.value }))}
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
          maxLength={60}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Categoría</span>
          <select
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value as Category }))}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Frecuencia</span>
          <select
            value={draft.frequency}
            onChange={e => setDraft(d => ({ ...d, frequency: e.target.value as RecurringFrequency }))}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          >
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
            <option value="year">Anual</option>
          </select>
        </label>
      </div>

      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--ink-500)' }}>
        Los cambios afectan los próximos pendientes generados. El que ya está activo no se modifica.
      </p>

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
              onClick={() => onDelete(rec.id)}
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

function formatNextDue(ymd: string): string {
  const today = new Date()
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (ymd === todayYMD) return 'hoy'

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowYMD = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (ymd === tomorrowYMD) return 'mañana'

  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
