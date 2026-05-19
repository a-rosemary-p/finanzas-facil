'use client'

/**
 * CategoryPicker — body controlable del picker de categorías (v0.32).
 *
 * Componente puramente presentacional (controlled): el padre maneja la
 * lista y reacciona a los cambios. Se usa:
 *  - Inline dentro de `ProfilePromptModal` step `categories` (sin modal shell)
 *  - Dentro de `CategoryPickerModal` que agrega overlay + Save/Cancel
 *
 * UI:
 *  - Counter "X / cap"
 *  - "Activas": pills con × para quitar (o callback onPick para seleccionar)
 *  - "Agregar del catálogo": pills del master que no están en la lista
 *  - "+ Personalizada": input + botón, Pro-gated (Free ve CTA upgrade)
 *
 * NO renderiza header, descripción, ni botones de submit. Eso vive en
 * los componentes que lo envuelven.
 */

import { useMemo, useState } from 'react'
import { CATEGORIES_MASTER, USER_CATEGORIES_CAP } from '@/lib/constants'
import { startProCheckout } from '@/lib/upgrade-to-pro'

interface Props {
  value: string[]
  isPro: boolean
  onChange: (newList: string[]) => void
  /** Si está set, click en una pill de "Activas" la pasa como callback en
   *  vez de borrarla (caso ConfirmationScreen donde el user "elige" una). */
  onPick?: (cat: string) => void
  /** Permite ocultar el counter cuando se anida en otro UI que ya lo muestra. */
  hideCounter?: boolean
}

export function CategoryPicker({ value, isPro, onChange, onPick, hideCounter }: Props) {
  const [customInput, setCustomInput] = useState('')
  const [error, setError] = useState('')

  const masterSelected = useMemo(() => new Set(value), [value])
  const addableFromMaster = useMemo(
    () => CATEGORIES_MASTER.filter(c => !masterSelected.has(c)),
    [masterSelected],
  )

  function addFromMaster(cat: string) {
    if (value.length >= USER_CATEGORIES_CAP) {
      setError(`Llegaste al máximo de ${USER_CATEGORIES_CAP} categorías.`)
      return
    }
    setError('')
    onChange([...value, cat])
  }

  function removeCategory(cat: string) {
    setError('')
    onChange(value.filter(c => c !== cat))
  }

  function addCustom() {
    if (!isPro) return
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (trimmed.length > 40) {
      setError('Máximo 40 caracteres por categoría.')
      return
    }
    if (value.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setError('Esa categoría ya está en tu lista.')
      return
    }
    if (value.length >= USER_CATEGORIES_CAP) {
      setError(`Llegaste al máximo de ${USER_CATEGORIES_CAP} categorías.`)
      return
    }
    setError('')
    onChange([...value, trimmed])
    setCustomInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      {!hideCounter && (
        <p className="text-xs tabular-nums self-end" style={{ color: 'var(--ink-500)' }}>
          {value.length} / {USER_CATEGORIES_CAP}
        </p>
      )}

      {/* Activas */}
      <div>
        <p
          className="text-[10px] font-bold uppercase mb-2"
          style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
        >
          Activas ({value.length})
        </p>
        {value.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--ink-500)' }}>
            Agrega al menos una categoría abajo.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {value.map(c => (
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

      {/* Agregar del catálogo */}
      {addableFromMaster.length > 0 && (
        <div>
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
      <div>
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
        <p className="text-xs -mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
