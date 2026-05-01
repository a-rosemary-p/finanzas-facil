'use client'

/**
 * ManualPendingForm — formulario inline para crear un pendiente manualmente
 * (sin pasar por dictar/escribir/foto). Aparece debajo del header de la
 * sección "Pendientes" cuando el user clickea el botón "+".
 *
 * Reusa la API existente `/api/entry/confirm` mandando un solo movement
 * de tipo 'pendiente' con `pendingDirection`. Esto evita duplicar la
 * lógica de free-plan-limit, audit trail y analytics.
 *
 * Cancelar/cerrar lo maneja el padre via `onClose`.
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
    <div
      className="rounded-xl flex flex-col gap-2 p-3"
      style={{ background: 'white', border: '1px solid var(--brand)', boxShadow: 'var(--sh-2)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-mid)' }}>
        Nuevo pendiente
      </div>

      {/* Toggle ingreso/gasto */}
      <div
        className="flex p-0.5 rounded-lg"
        style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
      >
        {(['gasto', 'ingreso'] as const).map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className="flex-1 text-xs font-bold py-1.5 rounded-md transition-colors"
            style={{
              background: direction === d ? 'var(--brand)' : 'transparent',
              color: direction === d ? '#fff' : 'var(--brand-mid)',
            }}
          >
            {d === 'gasto' ? 'Por pagar' : 'Por cobrar'}
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
          <span className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Vencimiento</span>
          <input
            type="date"
            value={movementDate}
            onChange={e => setMovementDate(e.target.value)}
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
          placeholder="Ej: Renta, Cliente Pemex, etc."
          className="border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
        />
      </label>

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
