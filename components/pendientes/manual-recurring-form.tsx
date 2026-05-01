'use client'

/**
 * ManualRecurringForm — formulario inline para crear un recurrente manualmente.
 * Aparece debajo del header de la sección "Recurrentes" cuando se clickea "+".
 *
 * Llama POST /api/recurring que ya existe (también materializa el primer
 * pendiente automáticamente).
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { getAppToday } from '@/lib/cdmx-date'
import type { Category, RecurringFrequency } from '@/types'

interface Props {
  onClose: () => void
  /** Llamado tras crear con éxito — el padre debe refrescar useRecurring() y usePendings(). */
  onCreated: () => void
}

const FREQ_OPTIONS: Array<{ id: RecurringFrequency; label: string }> = [
  { id: 'week',  label: 'Semanal' },
  { id: 'month', label: 'Mensual' },
  { id: 'year',  label: 'Anual'   },
]

export function ManualRecurringForm({ onClose, onCreated }: Props) {
  const [type, setType]             = useState<'gasto' | 'ingreso'>('gasto')
  const [amount, setAmount]         = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState<Category>('Renta')
  const [frequency, setFrequency]   = useState<RecurringFrequency>('month')
  const [nextDueDate, setNextDueDate] = useState<string>(getAppToday())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) {
      setError('Monto inválido.')
      return
    }
    if (!description.trim()) {
      setError('Agrega una descripción.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: Math.round(amt * 100) / 100,
          description: description.trim(),
          category,
          frequency,
          nextDueDate,
        }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) {
        setError((data['error'] as string) || 'No se pudo guardar.')
        setSaving(false)
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const valid = parseFloat(amount) > 0 && description.trim().length > 0

  return (
    <div
      className="rounded-xl flex flex-col gap-2 p-3"
      style={{ background: 'white', border: '1px solid var(--brand)', boxShadow: 'var(--sh-2)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-mid)' }}>
        Nuevo recurrente
      </div>

      {/* Toggle ingreso/gasto */}
      <div
        className="flex p-0.5 rounded-lg"
        style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
      >
        {(['gasto', 'ingreso'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="flex-1 text-xs font-bold py-1.5 rounded-md transition-colors"
            style={{
              background: type === t ? 'var(--brand)' : 'transparent',
              color: type === t ? '#fff' : 'var(--brand-mid)',
            }}
          >
            {t === 'gasto' ? 'Gasto' : 'Ingreso'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Monto</span>
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Próximo pago</span>
          <input
            type="date"
            value={nextDueDate}
            onChange={e => setNextDueDate(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Descripción</span>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={60}
          placeholder="Ej: Netflix, Renta, Cliente fijo, etc."
          className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Categoría</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Frecuencia</span>
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value as RecurringFrequency)}
            className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
          >
            {FREQ_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <div className="flex gap-1.5 justify-end mt-1">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium px-3 py-2 rounded-lg"
          style={{ color: 'var(--brand-mid)', minHeight: 36 }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !valid}
          className="text-xs font-bold px-3.5 py-2 rounded-lg text-white transition-opacity disabled:opacity-50"
          style={{ background: 'var(--brand)', minHeight: 36 }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
