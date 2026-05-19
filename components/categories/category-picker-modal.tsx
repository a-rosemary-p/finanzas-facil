'use client'

/**
 * CategoryPickerModal — picker reutilizable de categorías del user (v0.32).
 *
 * Usado en 3 surfaces:
 *  1. Onboarding final (ProfilePromptModal step categories) — `mode='setup'`
 *  2. Ajustes → editar categorías — `mode='manage'`
 *  3. ConfirmationScreen "Otra opción" — `mode='manage'` con selección
 *     final del usuario propagada al callback `onPick`.
 *
 * UI:
 *  - Header: título + counter "X / cap"
 *  - "Tus categorías": pills de la lista actual con ✕ para quitar
 *  - "Agregar del catálogo": pills del master que NO están seleccionadas
 *  - "+ Personalizada": input + botón Pro-gated (Free ve lock + CTA upgrade)
 *  - Footer: Guardar / Cancelar
 *
 * Componente puramente presentacional. El padre maneja la persistencia
 * vía `onSave(newList)` y opcionalmente `onPick(category)` cuando el user
 * selecciona una categoría específica (caso ConfirmationScreen).
 */

import { useMemo, useState } from 'react'
import { CATEGORIES_MASTER, USER_CATEGORIES_CAP } from '@/lib/constants'
import { startProCheckout } from '@/lib/upgrade-to-pro'

interface Props {
  /** Lista actual del user (orden importa — primero las más recientes). */
  selected: string[]
  isPro: boolean
  /** Texto del botón principal según contexto. */
  saveLabel?: string
  /** Llamado al darle "Guardar". Recibe la nueva lista completa. */
  onSave: (newList: string[]) => Promise<void> | void
  /** Llamado al cancelar / cerrar sin guardar. */
  onClose: () => void
  /** Si el padre quiere también que el user "elija" una específica del
   *  set (ej. para asignar a un movimiento en ConfirmationScreen), provee
   *  este callback. Se dispara con la categoría seleccionada al hacer click
   *  en un pill de la lista del user. */
  onPick?: (category: string) => void
  /** Texto descriptivo opcional debajo del título. */
  description?: string
  /** Bloquea el botón de cerrar (sin overlay click) — para mode bloqueante. */
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
  blocking,
}: Props) {
  // Mantenemos selected como estado interno mutable para que el user pueda
  // hacer cambios (toggles + custom adds) antes de Guardar.
  const [list, setList] = useState<string[]>(() => [...selected])
  const [customInput, setCustomInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const masterSelected = useMemo(() => new Set(list), [list])
  const addableFromMaster = useMemo(
    () => CATEGORIES_MASTER.filter(c => !masterSelected.has(c)),
    [masterSelected],
  )

  function addFromMaster(cat: string) {
    if (list.length >= USER_CATEGORIES_CAP) {
      setError(`Llegaste al máximo de ${USER_CATEGORIES_CAP} categorías.`)
      return
    }
    setError('')
    setList(prev => [...prev, cat])
  }

  function removeCategory(cat: string) {
    setError('')
    setList(prev => prev.filter(c => c !== cat))
  }

  function addCustom() {
    if (!isPro) return
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (trimmed.length > 40) {
      setError('Máximo 40 caracteres por categoría.')
      return
    }
    if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setError('Esa categoría ya está en tu lista.')
      return
    }
    if (list.length >= USER_CATEGORIES_CAP) {
      setError(`Llegaste al máximo de ${USER_CATEGORIES_CAP} categorías.`)
      return
    }
    setError('')
    setList(prev => [...prev, trimmed])
    setCustomInput('')
  }

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
            Tus categorías
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

        {/* Lista actual */}
        <div className="mb-4">
          <p
            className="text-[10px] font-bold uppercase mb-2"
            style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
          >
            Activas ({list.length})
          </p>
          {list.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--ink-500)' }}>
              Agrega al menos una categoría abajo.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {list.map(c => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => onPick ? onPick(c) : removeCategory(c)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium"
                    style={{
                      background: 'var(--brand-chip)',
                      border: '1px solid var(--brand-light)',
                      color: 'var(--brand)',
                    }}
                    aria-label={onPick ? `Usar categoría ${c}` : `Quitar ${c}`}
                  >
                    {c}
                    {!onPick && (
                      <span aria-hidden="true" style={{ opacity: 0.7, fontSize: 14, lineHeight: 1 }}>
                        ×
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Addable from master */}
        {addableFromMaster.length > 0 && (
          <div className="mb-4">
            <p
              className="text-[10px] font-bold uppercase mb-2"
              style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
            >
              Agregar del catálogo
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {addableFromMaster.map(c => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => addFromMaster(c)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium"
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--brand-border)',
                      color: 'var(--ink-700)',
                    }}
                  >
                    <span aria-hidden="true" style={{ opacity: 0.7 }}>+</span>
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Custom — Pro only */}
        <div className="mb-3">
          <p
            className="text-[10px] font-bold uppercase mb-2"
            style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
          >
            Personalizada
            {!isPro && (
              <span
                className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px]"
                style={{ background: 'var(--brand)', color: '#fff', letterSpacing: '0.05em' }}
              >
                PRO
              </span>
            )}
          </p>
          {isPro ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Ej: Lavandería"
                maxLength={40}
                className="fz-input flex-1"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customInput.trim()}
                className="text-sm font-bold px-3 rounded-xl disabled:opacity-50"
                style={{ background: 'var(--brand)', color: '#fff', minHeight: 40 }}
              >
                Agregar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { void startProCheckout() }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs"
              style={{
                background: 'var(--brand-chip)',
                border: '1px dashed var(--brand-light)',
                color: 'var(--brand-mid)',
              }}
            >
              Crea categorías propias con Fiza Pro →
            </button>
          )}
        </div>

        {error && (
          <p className="text-xs mb-2" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-4">
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
