'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, getTodayString } from '@/lib/utils'
import { MOVEMENT_TYPES, MOVEMENT_TYPE_CONFIG } from '@/lib/constants'
import { getUserCategories } from '@/lib/giro-categories'
import { useAuth } from '@/hooks/use-auth'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { PendingMovement, Entry } from '@/types'

interface ConfirmationScreenProps {
  rawText: string
  entryDate: string
  initialMovements: PendingMovement[]
  /** Cómo se capturó la entry. Default 'text' para retro-compat. */
  inputSource?: 'text' | 'voice' | 'photo'
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
  inputSource = 'text',
  onConfirmed,
  onCancel,
}: ConfirmationScreenProps) {
  const [movements, setMovements] = useState<PendingMovement[]>(initialMovements)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Categorías para el dropdown de edición — lista curada del user
  // (v0.32) con fallback a defaults del giro si no la ha curado todavía.
  // Si la IA devolvió una cat que no está en el set actual, la incluimos
  // como opción para no perder lo que generó.
  const { profile } = useAuth()
  const categoryOptions = useMemo(() => {
    const resolved = getUserCategories({
      categories: profile?.categories,
      giro: profile?.giro,
    })
    const base = resolved.list
    const extras: string[] = []
    for (const m of movements) {
      const c = m.category as string | undefined
      if (typeof c === 'string' && c.length > 0 && !base.includes(c)) extras.push(c)
    }
    return [...new Set([...base, ...extras])]
  }, [profile?.categories, profile?.giro, movements])

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
        body: JSON.stringify({ rawText, entryDate, movements: valid, inputSource }),
      })
      const data: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const err = (data ?? {}) as Record<string, unknown>
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
        <h2 className="font-bold text-lg text-brand">
          Revisemos tus movimientos
        </h2>
        <p className="text-sm italic mt-1 line-clamp-2 text-brand-mid">
          &ldquo;{rawText}&rdquo;
        </p>
      </div>

      {/* Lista de movimientos editables */}
      {movements.map((m, idx) => (
        <div key={m.tempId} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3 border border-brand-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-brand-mid">
              Movimiento {idx + 1}
            </span>
            <button
              onClick={() => remove(m.tempId)}
              className="text-sm min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors text-danger"
              title="Eliminar"
            >
              ✕
            </button>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1">
            <label className="fz-input-label">Tipo</label>
            <select
              value={m.type}
              onChange={e => update(m.tempId, { type: e.target.value as PendingMovement['type'] })}
              className="fz-input"
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t} value={t}>{MOVEMENT_TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-1">
            <label className="fz-input-label">
              Monto {m.originalCurrency && m.originalCurrency !== 'MXN' ? '(MXN)' : '($)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={m.amount || ''}
              onChange={e => update(m.tempId, { amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="fz-input"
            />
          </div>

          {/* Tipo de cambio — solo visible cuando hay moneda extranjera */}
          {m.originalCurrency && m.originalCurrency !== 'MXN' && (
            <div className="flex flex-col gap-2 rounded-lg px-3 py-2.5 bg-brand-chip border border-brand-border">
              <p className="text-xs font-medium text-brand-mid">
                Tipo de cambio · {m.originalCurrency} → MXN
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-muted">
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
                  className="fz-input w-20"
                />
                <span className="text-xs font-semibold text-brand">
                  = {formatCurrency(m.amount)}
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Ajusta si el tipo de cambio del día es diferente.
              </p>
            </div>
          )}

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="fz-input-label">Descripción</label>
            <input
              type="text"
              value={m.description}
              onChange={e => update(m.tempId, { description: e.target.value })}
              placeholder="Ej: Venta de tacos"
              maxLength={60}
              className="fz-input"
            />
          </div>

          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label className="fz-input-label">Categoría</label>
            <select
              value={m.category}
              onChange={e => update(m.tempId, { category: e.target.value as PendingMovement['category'] })}
              className="fz-input"
            >
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1">
            <label className="fz-input-label">Fecha</label>
            <input
              type="date"
              value={m.movementDate}
              max={m.type === 'pendiente' ? undefined : getTodayString()}
              onChange={e => update(m.tempId, { movementDate: e.target.value })}
              className="fz-input"
            />
          </div>

          {/* Pendiente: dirección */}
          {m.type === 'pendiente' && (
            <div className="flex flex-col gap-1">
              <label className="fz-input-label">¿Vas a cobrar o vas a pagar?</label>
              <div className="flex gap-1 p-1 rounded-lg bg-brand-chip border border-brand-border">
                {([
                  { value: 'gasto'   as const, label: 'Voy a pagar'    },
                  { value: 'ingreso' as const, label: 'Me van a pagar' },
                ]).map(opt => {
                  const active = (m.pendingDirection ?? 'gasto') === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update(m.tempId, { pendingDirection: opt.value })}
                      className={[
                        'flex-1 text-xs font-bold rounded-md py-1.5 transition-colors',
                        active ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Toggle inversión */}
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={m.isInvestment ?? false}
              onChange={e => update(m.tempId, { isInvestment: e.target.checked })}
              className="w-4 h-4 fz-investment-check"
            />
            <span className="text-xs text-brand-mid">
              Marcar como inversión (activo a largo plazo)
            </span>
          </label>

          {/* Recurrente */}
          <div
            className={[
              'flex flex-col gap-1.5 rounded-lg p-2.5 border',
              m.isRecurring ? 'bg-brand-chip border-brand-border' : 'bg-transparent border-transparent',
            ].join(' ')}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={m.isRecurring ?? false}
                onChange={e => update(m.tempId, {
                  isRecurring: e.target.checked,
                  recurringFrequency: e.target.checked ? (m.recurringFrequency ?? 'month') : null,
                })}
                className="w-4 h-4 fz-brand-check"
              />
              <span className={`text-xs font-medium ${m.isRecurring ? 'text-brand' : 'text-brand-mid'}`}>
                Se repite cada
              </span>
              {m.isRecurring && (
                <select
                  value={m.recurringFrequency ?? 'month'}
                  onChange={e => update(m.tempId, { recurringFrequency: e.target.value as 'week' | 'month' | 'year' })}
                  className="text-xs font-bold border border-brand rounded-md px-2 py-1 focus:outline-none text-brand bg-white"
                >
                  <option value="week">semana</option>
                  <option value="month">mes</option>
                  <option value="year">año</option>
                </select>
              )}
            </label>
            {m.isRecurring && (
              <p className="text-[11px] leading-relaxed text-brand-mid">
                El próximo se va a generar como pendiente cuando este se pague.
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Agregar movimiento manualmente */}
      <button
        onClick={addEmpty}
        className="w-full py-3 rounded-xl text-sm font-medium border border-brand text-brand bg-white transition-colors min-h-[44px]"
      >
        + Agregar movimiento manualmente
      </button>

      {/* Resumen */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-brand-border">
        <p className="text-xs font-bold uppercase mb-2 text-brand-mid">
          Resumen — {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-brand">Ingresos: +{formatCurrency(summary.income)}</span>
          <span className="text-danger">Gastos: −{formatCurrency(summary.expenses)}</span>
          <span className={`font-bold ${summary.net >= 0 ? 'text-brand' : 'text-danger'}`}>
            Neto: {summary.net >= 0 ? '+' : '−'}{formatCurrency(summary.net)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {/* Acciones */}
      <button
        onClick={handleConfirm}
        disabled={loading || movements.length === 0}
        className="w-full text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px] bg-brand"
      >
        {loading ? 'Guardando...' : 'Confirmar y registrar'}
      </button>

      <button
        onClick={onCancel}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] text-brand-mid bg-paper-2"
      >
        Cancelar
      </button>
    </div>
  )
}
