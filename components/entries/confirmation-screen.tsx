'use client'

import { useState } from 'react'
import { formatCurrency, getTodayString } from '@/lib/utils'
import { CATEGORIES, MOVEMENT_TYPES, MOVEMENT_TYPE_CONFIG } from '@/lib/constants'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { PendingMovement, Entry } from '@/types'

interface ConfirmationScreenProps {
  rawText: string
  entryDate: string
  initialMovements: PendingMovement[]
  onConfirmed: (entry: Entry) => void
  onCancel: () => void
}

function emptyMovement(date: string): PendingMovement {
  return {
    tempId: crypto.randomUUID(),
    type: 'ingreso',
    amount: 0,
    description: '',
    category: 'Ventas',
    movementDate: date,
  }
}

function calcSummary(movements: PendingMovement[]) {
  let income = 0, expenses = 0
  for (const m of movements) {
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

export function ConfirmationScreen({
  rawText,
  entryDate,
  initialMovements,
  onConfirmed,
  onCancel,
}: ConfirmationScreenProps) {
  const [movements, setMovements] = useState<PendingMovement[]>(initialMovements)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(tempId: string, patch: Partial<PendingMovement>) {
    setMovements(prev =>
      prev.map(m => (m.tempId === tempId ? { ...m, ...patch } : m))
    )
  }

  function remove(tempId: string) {
    setMovements(prev => prev.filter(m => m.tempId !== tempId))
  }

  function addEmpty() {
    setMovements(prev => [...prev, emptyMovement(entryDate)])
  }

  async function handleConfirm() {
    const valid = movements.filter(m => m.amount > 0 && m.description.trim())
    if (valid.length === 0) {
      setError('Agrega al menos un movimiento válido.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetchWithAuthRetry('/api/entry/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, entryDate, movements: valid }),
      })
      const data: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const err = (data ?? {}) as Record<string, unknown>
        // Loguea el detalle al console para que sea diagnosticable cuando el
        // user reporta "error al guardar". El UX queda igual.
        console.error('[confirm] failed', { status: res.status, body: err, sent: { rawText, entryDate, movements: valid } })
        setError((err['message'] as string) || (err['error'] as string) || `Error al confirmar (${res.status}).`)
        setLoading(false)
        return
      }

      const { entry } = data as { entry: Entry }
      onConfirmed(entry)
    } catch (err) {
      console.error('[confirm] network error', err)
      setError('No pudimos conectar. Intenta de nuevo.')
      setLoading(false)
    }
  }

  const summary = calcSummary(movements)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="font-bold text-lg" style={{ color: 'var(--brand)' }}>
          Revisemos tus movimientos
        </h2>
        <p className="text-sm italic mt-1 line-clamp-2" style={{ color: 'var(--brand-mid)' }}>
          "{rawText}"
        </p>
      </div>

      {/* Lista de movimientos editables */}
      {movements.map((m, idx) => (
        <div
          key={m.tempId}
          className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3"
          style={{ border: '1px solid var(--brand-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--brand-mid)' }}>
              Movimiento {idx + 1}
            </span>
            <button
              onClick={() => remove(m.tempId)}
              className="text-sm min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--danger)' }}
              title="Eliminar"
            >
              ✕
            </button>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Tipo</label>
            <select
              value={m.type}
              onChange={e => update(m.tempId, { type: e.target.value as PendingMovement['type'] })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t} value={t}>{MOVEMENT_TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>
              Monto {m.originalCurrency && m.originalCurrency !== 'MXN' ? '(MXN)' : '($)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={m.amount || ''}
              onChange={e => update(m.tempId, { amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            />
          </div>

          {/* Tipo de cambio — solo visible cuando hay moneda extranjera */}
          {m.originalCurrency && m.originalCurrency !== 'MXN' && (
            <div
              className="flex flex-col gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>
                Tipo de cambio · {m.originalCurrency} → MXN
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {m.originalAmount} {m.originalCurrency} ×
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={m.exchangeRateUsed ?? (m.originalCurrency === 'USD' ? 17 : 18.5)}
                  onChange={e => {
                    const rate = parseFloat(e.target.value) || 1
                    const orig = m.originalAmount ?? m.amount
                    update(m.tempId, {
                      exchangeRateUsed: rate,
                      amount: Math.round(orig * rate * 100) / 100,
                    })
                  }}
                  className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 w-20"
                  style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)', background: '#fff' }}
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                  = {formatCurrency(m.amount)}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                Ajusta si el tipo de cambio del día es diferente.
              </p>
            </div>
          )}

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Descripción</label>
            <input
              type="text"
              value={m.description}
              onChange={e => update(m.tempId, { description: e.target.value })}
              placeholder="Ej: Venta de tacos"
              maxLength={60}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            />
          </div>

          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Categoría</label>
            <select
              value={m.category}
              onChange={e => update(m.tempId, { category: e.target.value as PendingMovement['category'] })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>Fecha</label>
            <input
              type="date"
              value={m.movementDate}
              max={getTodayString()}
              onChange={e => update(m.tempId, { movementDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
            />
          </div>

          {/* Toggle inversión */}
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={m.isInvestment ?? false}
              onChange={e => update(m.tempId, { isInvestment: e.target.checked })}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-xs" style={{ color: 'var(--brand-mid)' }}>
              Marcar como inversión (activo a largo plazo)
            </span>
          </label>
        </div>
      ))}

      {/* Agregar movimiento manualmente */}
      <button
        onClick={addEmpty}
        className="w-full py-3 rounded-xl text-sm font-medium border transition-colors min-h-[44px]"
        style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: '#fff' }}
      >
        + Agregar movimiento manualmente
      </button>

      {/* Resumen */}
      <div
        className="bg-white rounded-xl shadow-sm p-4"
        style={{ border: '1px solid var(--brand-border)' }}
      >
        <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--brand-mid)' }}>
          Resumen — {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
        </p>
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--brand)' }}>Ingresos: +{formatCurrency(summary.income)}</span>
          <span style={{ color: 'var(--danger)' }}>Gastos: −{formatCurrency(summary.expenses)}</span>
          <span style={{ color: summary.net >= 0 ? 'var(--brand)' : 'var(--danger)', fontWeight: 700 }}>
            Neto: {summary.net >= 0 ? '+' : '−'}{formatCurrency(summary.net)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {/* Acciones */}
      <button
        onClick={handleConfirm}
        disabled={loading || movements.length === 0}
        className="w-full text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
        style={{ background: 'var(--brand)' }}
      >
        {loading ? 'Guardando...' : 'Confirmar y registrar'}
      </button>

      <button
        onClick={onCancel}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
        style={{ color: 'var(--brand-mid)', background: '#F5F5F5' }}
      >
        Cancelar
      </button>
    </div>
  )
}
