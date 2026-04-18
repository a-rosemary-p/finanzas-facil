'use client'

import { useState } from 'react'
import { formatCurrency, getTodayString } from '@/lib/utils'
import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
import type { PendingMovement, Entry } from '@/types'

interface ConfirmationScreenProps {
  rawText: string
  entryDate: string
  initialMovements: PendingMovement[]
  onConfirmed: (entry: Entry) => void
  onCancel: () => void
}

const TYPE_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  pendiente: 'Pendiente',
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
      const res = await fetch('/api/entry/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, entryDate, movements: valid }),
      })
      const data: unknown = await res.json()

      if (!res.ok) {
        const err = data as Record<string, unknown>
        setError((err['message'] as string) || (err['error'] as string) || 'Error al confirmar.')
        setLoading(false)
        return
      }

      const { entry } = data as { entry: Entry }
      onConfirmed(entry)
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.')
      setLoading(false)
    }
  }

  const summary = calcSummary(movements)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="font-bold text-lg" style={{ color: '#1A2B3A' }}>
          Revisemos tus movimientos
        </h2>
        <p className="text-sm italic mt-1 line-clamp-2" style={{ color: '#5A7A8A' }}>
          "{rawText}"
        </p>
      </div>

      {/* Lista de movimientos editables */}
      {movements.map((m, idx) => (
        <div
          key={m.tempId}
          className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3"
          style={{ border: '1px solid #E0E0E0' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase" style={{ color: '#5A7A8A' }}>
              Movimiento {idx + 1}
            </span>
            <button
              onClick={() => remove(m.tempId)}
              className="text-sm min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#C62828' }}
              title="Eliminar"
            >
              🗑️
            </button>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>Tipo</label>
            <select
              value={m.type}
              onChange={e => update(m.tempId, { type: e.target.value as PendingMovement['type'] })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>Monto ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={m.amount || ''}
              onChange={e => update(m.tempId, { amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            />
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>Descripción</label>
            <input
              type="text"
              value={m.description}
              onChange={e => update(m.tempId, { description: e.target.value })}
              placeholder="Ej: Venta de tacos"
              maxLength={60}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            />
          </div>

          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>Categoría</label>
            <select
              value={m.category}
              onChange={e => update(m.tempId, { category: e.target.value as PendingMovement['category'] })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>Fecha</label>
            <input
              type="date"
              value={m.movementDate}
              max={getTodayString()}
              onChange={e => update(m.tempId, { movementDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            />
          </div>
        </div>
      ))}

      {/* Agregar movimiento manualmente */}
      <button
        onClick={addEmpty}
        className="w-full py-3 rounded-xl text-sm font-medium border transition-colors min-h-[44px]"
        style={{ borderColor: '#2E7D32', color: '#2E7D32', background: '#fff' }}
      >
        + Agregar movimiento manualmente
      </button>

      {/* Resumen */}
      <div
        className="bg-white rounded-xl shadow-sm p-4"
        style={{ border: '1px solid #E0E0E0' }}
      >
        <p className="text-xs font-bold uppercase mb-2" style={{ color: '#5A7A8A' }}>
          Resumen — {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
        </p>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#2E7D32' }}>Ingresos: +{formatCurrency(summary.income)}</span>
          <span style={{ color: '#C62828' }}>Gastos: −{formatCurrency(summary.expenses)}</span>
          <span style={{ color: summary.net >= 0 ? '#2E7D32' : '#C62828', fontWeight: 700 }}>
            Neto: {summary.net >= 0 ? '+' : '−'}{formatCurrency(summary.net)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>
      )}

      {/* Acciones */}
      <button
        onClick={handleConfirm}
        disabled={loading || movements.length === 0}
        className="w-full text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
        style={{ background: '#2E7D32' }}
      >
        {loading ? 'Guardando...' : 'Confirmar y registrar'}
      </button>

      <button
        onClick={onCancel}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
        style={{ color: '#5A7A8A', background: '#F5F5F5' }}
      >
        Cancelar
      </button>
    </div>
  )
}
