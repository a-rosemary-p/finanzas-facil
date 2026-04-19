'use client'

import { useState } from 'react'
import { formatCurrency, formatEntryDate, getTodayString } from '@/lib/utils'
import { MOVEMENT_TYPES } from '@/lib/constants'
import type { Movement } from '@/types'

interface MovementCardProps {
  movement: Movement
  onUpdated: (updated: Movement) => void
  onDeleted: (id: string) => void
  hideDate?: boolean
}

const TYPE_CONFIG = {
  ingreso: {
    label: 'Ingreso',
    bg: '#DAE68F',
    color: '#578466',
    border: '#92C3A5',
    sign: '+',
  },
  gasto: {
    label: 'Gasto',
    bg: '#FAD5BF',
    color: '#D0481A',
    border: '#F79366',
    sign: '−',
  },
  pendiente: {
    label: 'Pendiente',
    bg: '#FFF5CC',
    color: '#B89010',
    border: '#FFCE57',
    sign: '⏳ ',
  },
} as const

export function MovementCard({ movement, onUpdated, onDeleted, hideDate = false }: MovementCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const [editType, setEditType] = useState(movement.type)
  const [editDescription, setEditDescription] = useState(movement.description)
  const [editAmount, setEditAmount] = useState(String(movement.amount))
  const [editDate, setEditDate] = useState(movement.movementDate)
  const [editIsInvestment, setEditIsInvestment] = useState(movement.isInvestment)

  const cfg = TYPE_CONFIG[movement.type]
  const busy = saving || deleting
  const cardBorder = movement.isInvestment ? '1.5px solid #FFCE57' : '1px solid #D9E8D0'

  function openEdit() {
    setEditType(movement.type)
    setEditDescription(movement.description)
    setEditAmount(String(movement.amount))
    setEditDate(movement.movementDate)
    setEditIsInvestment(movement.isInvestment)
    setError(''); setConfirmDelete(false); setEditing(true)
  }

  function cancelEdit() { setEditing(false); setError(''); setConfirmDelete(false) }

  async function handleSave() {
    const amountNum = parseFloat(editAmount.replace(',', '.'))
    if (!editDescription.trim()) { setError('Escribe una descripción'); return }
    if (isNaN(amountNum) || amountNum <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/movements/${movement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: editType, amount: amountNum, description: editDescription.trim(), movementDate: editDate, isInvestment: editIsInvestment }),
      })
      const data = await res.json() as { movement?: Movement; error?: string }
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      onUpdated(data.movement!); setEditing(false)
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/movements/${movement.id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json() as { error?: string }; setError(data.error ?? 'Error al borrar'); return }
      onDeleted(movement.id)
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setDeleting(false) }
  }

  /* ── Modo edición ── */
  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3" style={{ border: '1px solid #92C3A5' }}>
        {/* Selector de tipo */}
        <div className="flex gap-2">
          {MOVEMENT_TYPES.map(t => {
            const tcfg = TYPE_CONFIG[t]
            const active = editType === t
            return (
              <button key={t} type="button" onClick={() => setEditType(t)} disabled={busy}
                className="flex-1 py-1.5 rounded-full text-xs font-bold border transition-colors"
                style={active
                  ? { background: tcfg.bg, color: tcfg.color, borderColor: tcfg.border }
                  : { background: '#F4F6EB', color: '#8AAB94', borderColor: '#D9E8D0' }
                }
              >
                {tcfg.label}
              </button>
            )
          })}
        </div>

        <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
          placeholder="Descripción" maxLength={60} disabled={busy}
          className="border rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2"
          style={{ borderColor: '#D9E8D0', color: '#578466' }}
        />

        <div className="flex gap-2">
          <div className="flex-1 relative min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none" style={{ color: '#6B8C78' }}>$</span>
            <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
              placeholder="0" min="0.01" step="0.01" disabled={busy}
              className="border rounded-lg pl-7 pr-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2"
              style={{ borderColor: '#D9E8D0', color: '#578466' }}
            />
          </div>
          <input type="date" value={editDate} max={getTodayString()} onChange={e => setEditDate(e.target.value)}
            disabled={busy}
            className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 shrink-0"
            style={{ borderColor: '#D9E8D0', color: '#578466', width: '138px' }}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editIsInvestment} onChange={e => setEditIsInvestment(e.target.checked)}
            disabled={busy} className="w-4 h-4" style={{ accentColor: '#FFCE57' }}
          />
          <span className="text-xs" style={{ color: '#6B8C78' }}>📈 Marcar como inversión (activo a largo plazo)</span>
        </label>

        {error && <p className="text-xs" style={{ color: '#D0481A' }}>{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#578466' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={cancelEdit} disabled={busy}
            className="py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
            style={{ borderColor: '#D9E8D0', color: '#6B8C78', background: '#F4F6EB' }}
          >
            Cancelar
          </button>
        </div>

        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy}
            className="w-full py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ color: '#D0481A', background: '#FFF0EA', border: '1px solid #FAD5BF' }}
          >
            Borrar movimiento
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={handleDelete} disabled={busy}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#D0481A' }}
            >
              {deleting ? 'Borrando...' : '¿Confirmar borrado?'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}
              className="py-2 px-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: '#D9E8D0', color: '#6B8C78', background: '#F4F6EB' }}
            >
              No
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── Vista normal ── */
  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3" style={{ border: cardBorder }}>
      {movement.isInvestment && <span className="text-base shrink-0" title="Inversión">📈</span>}

      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[5rem] text-center"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: '#578466' }}>
          {movement.description}
        </p>
        {!hideDate && (
          <p className="text-xs mt-0.5" style={{ color: '#6B8C78' }}>{formatEntryDate(movement.movementDate)}</p>
        )}
        {movement.isInvestment && (
          <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#B89010' }}>Inversión</p>
        )}
      </div>

      <span className="text-base font-bold shrink-0" style={{ color: cfg.color }}>
        {cfg.sign}{formatCurrency(movement.amount)}
      </span>

      <button type="button" onClick={openEdit}
        className="shrink-0 p-1.5 rounded-lg transition-colors flex items-center justify-center"
        style={{ color: '#8AAB94', background: '#F4F6EB' }}
        aria-label="Editar movimiento"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  )
}
