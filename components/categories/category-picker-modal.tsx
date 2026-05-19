'use client'

/**
 * CategoryPickerModal — wrapper modal del CategoryPicker (v0.32).
 *
 * Usado en:
 *  - Ajustes → editar categorías (mode regular, dismissable)
 *  - ConfirmationScreen "Otra opción" (mode regular, dismissable, onPick set)
 *  - Re-onboarding bloqueante para users existentes (blocking=true)
 *
 * El picker (state interno) → modal shell con overlay, header, descripción,
 * Save/Cancel footer.
 */

import { useState } from 'react'
import { USER_CATEGORIES_CAP } from '@/lib/constants'
import { CategoryPicker } from './category-picker'

interface Props {
  /** Lista actual del user. */
  selected: string[]
  isPro: boolean
  saveLabel?: string
  /** Llamado al guardar (botón Save). Recibe la lista final. */
  onSave: (newList: string[]) => Promise<void> | void
  onClose: () => void
  /** Cuando está set, click en una pill de "Activas" persiste la lista
   *  actual y selecciona esa categoría (caso ConfirmationScreen). El modal
   *  llama primero `onSave(currentList)` y luego `onPick(cat)`. */
  onPick?: (category: string) => void
  description?: string
  title?: string
  /** Bloquea cierre via overlay click. Mode forzado para re-onboarding. */
  blocking?: boolean
}

export function CategoryPickerModal({
  selected,
  isPro,
  saveLabel = 'Guardar',
  onSave,
  onClose,
  onPick,
  description,
  title = 'Tus categorías',
  blocking,
}: Props) {
  const [list, setList] = useState<string[]>(() => [...selected])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSave(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  // Si onPick está provisto y el user le da click a una pill activa,
  // persistimos la lista actual (puede tener cats agregadas/quitadas) ANTES
  // de propagar el pick al padre. Si la lista cambió o no, igual llamamos
  // a onSave para mantener semántica simple — el endpoint es idempotente.
  async function handlePick(cat: string) {
    if (!onPick || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSave(list)
      onPick(cat)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={blocking || submitting ? undefined : onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14, 23, 17, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 100,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'auto',
          background: 'var(--paper)',
          borderRadius: 22,
          boxShadow: 'var(--sh-3)',
          padding: '20px 18px',
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-bold" style={{ color: 'var(--brand)', fontSize: 18 }}>
            {title}
          </h2>
          <span className="text-xs tabular-nums" style={{ color: 'var(--ink-500)' }}>
            {list.length} / {USER_CATEGORIES_CAP}
          </span>
        </div>

        {description && (
          <p className="text-sm mb-4" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        <CategoryPicker
          value={list}
          isPro={isPro}
          onChange={setList}
          onPick={onPick ? handlePick : undefined}
          hideCounter
        />

        {error && (
          <p className="text-xs mt-3" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 text-sm font-medium rounded-xl disabled:opacity-60"
              style={{
                background: 'transparent',
                border: '1px solid var(--brand-border)',
                color: 'var(--brand-mid)',
                minHeight: 44,
              }}
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || list.length === 0}
            className="flex-1 text-sm font-bold rounded-xl text-white disabled:opacity-70"
            style={{ background: 'var(--brand)', minHeight: 44 }}
          >
            {submitting ? 'Guardando…' : saveLabel}
          </button>
        </div>
      </div>
    </>
  )
}
