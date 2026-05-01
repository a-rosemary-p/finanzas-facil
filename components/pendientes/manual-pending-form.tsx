'use client'

/**
 * ManualPendingForm — formulario inline para crear un pendiente manualmente.
 * Reusa la API existente `/api/entry/confirm` mandando un solo movement
 * de tipo 'pendiente' con `pendingDirection`.
 */

import { useState } from 'react'
import { CATEGORIES } from '@/lib/constants'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { getAppToday } from '@/lib/cdmx-date'
import type { Category } from '@/types'

interface Props {
  onClose: () => void
  /** Llamado tras crear con éxito — el padre debe refrescar usePendings(). */
  onCreated: () => void
}

export function ManualPendingForm({ onClose, onCreated }: Props) {
  const [direction, setDirection]   = useState<'gasto' | 'ingreso'>('gasto')
  const [amount, setAmount]         = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState<Category>('Renta')
  const [movementDate, setMovementDate] = useState<string>(getAppToday())
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
      const res = await fetchWithAuthRetry('/api/entry/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: description.trim(),
          entryDate: getAppToday(),
          inputSource: 'text',
          movements: [{
            type: 'pendiente',
            amount: Math.round(amt * 100) / 100,
            description: description.trim(),
            category,
            movementDate,
            isInvestment: false,
            originalAmount: amt,
            originalCurrency: 'MXN',
            exchangeRateUsed: 1,
            pendingDirection: direction,
            isRecurring: false,
            recurringFrequency: null,
          }],
        }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) {
        setError((data['message'] as string) || (data['error'] as string) || 'No se pudo guardar.')
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
    <div className="fz-card-active flex flex-col gap-2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mid">
        Nuevo pendiente
      </div>

      {/* Toggle ingreso/gasto */}
      <div className="flex p-0.5 rounded-lg bg-brand-chip border border-brand-border">
        {(['gasto', 'ingreso'] as const).map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={[
              'flex-1 text-xs font-bold py-1.5 rounded-md transition-colors',
              direction === d ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
            ].join(' ')}
          >
            {d === 'gasto' ? 'Por pagar' : 'Por cobrar'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Monto</span>
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="fz-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="fz-input-label">Vencimiento</span>
          <input
            type="date"
            value={movementDate}
            onChange={e => setMovementDate(e.target.value)}
            className="fz-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="fz-input-label">Descripción</span>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={60}
          placeholder="Ej: Renta, Cliente Pemex, etc."
          className="fz-input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="fz-input-label">Categoría</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className="fz-input"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      <div className="flex gap-1.5 justify-end mt-1">
        <button type="button" onClick={onClose} className="fz-btn-ghost">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !valid}
          className="fz-btn-primary"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
