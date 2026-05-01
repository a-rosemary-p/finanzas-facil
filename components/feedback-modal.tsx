'use client'

/**
 * FeedbackModal — popup para que el user mande sugerencias / comentarios /
 * reportes de problemas. POST a /api/feedback que internamente lo manda
 * por correo al admin. El user NO sabe la dirección destino; para él es
 * solo "queremos saber qué piensas".
 *
 * UX:
 *  - Toggle de tipo (sugerencia / comentario / problema)
 *  - Textarea con counter (max 2000)
 *  - [Cancelar] [Enviar]
 *  - Tras éxito → mensaje "Gracias, lo recibimos" + auto-cierre en 1.6s
 *
 * Cierre:
 *  - Click en backdrop → cierra (a menos que se esté enviando)
 *  - Tecla Escape → cierra
 */

import { useEffect, useRef, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'

type Kind = 'sugerencia' | 'comentario' | 'problema'
type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; msg: string }
  | { kind: 'success' }

const TYPE_OPTIONS: Array<{ id: Kind; label: string }> = [
  { id: 'comentario', label: 'Comentario' },
  { id: 'sugerencia', label: 'Sugerencia' },
  { id: 'problema',   label: 'Problema'   },
]

const PLACEHOLDER: Record<Kind, string> = {
  comentario: '¿Qué te gusta? ¿Qué cambiarías? Cuéntanos.',
  sugerencia: '¿Qué feature te haría la vida más fácil?',
  problema:   'Describe qué pasó. Si puedes, dinos qué estabas haciendo cuando ocurrió.',
}

interface Props {
  open: boolean
  onClose: () => void
}

export function FeedbackModal({ open, onClose }: Props) {
  const [kind, setKind] = useState<Kind>('comentario')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset state al abrir.
  useEffect(() => {
    if (!open) return
    setKind('comentario')
    setMessage('')
    setState({ kind: 'idle' })
    // Focus después del render — sin esto el caret no entra.
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Cerrar con Escape (a menos que se esté enviando).
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.kind !== 'sending') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, state.kind, onClose])

  // Auto-cerrar tras éxito.
  useEffect(() => {
    if (state.kind !== 'success') return
    const t = setTimeout(onClose, 1600)
    return () => clearTimeout(t)
  }, [state.kind, onClose])

  if (!open) return null

  async function handleSubmit() {
    const trimmed = message.trim()
    if (trimmed.length < 1) {
      setState({ kind: 'error', msg: 'Escribe al menos algo.' })
      return
    }
    if (trimmed.length > 2000) {
      setState({ kind: 'error', msg: 'Máximo 2000 caracteres.' })
      return
    }

    setState({ kind: 'sending' })
    try {
      const res = await fetchWithAuthRetry('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message: trimmed }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) {
        setState({
          kind: 'error',
          msg: (data['error'] as string) || 'No se pudo enviar.',
        })
        return
      }
      setState({ kind: 'success' })
    } catch {
      setState({ kind: 'error', msg: 'Sin conexión. Intenta de nuevo.' })
    }
  }

  const sending = state.kind === 'sending'
  const success = state.kind === 'success'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      className="fz-feedback-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose()
      }}
    >
      <div className="fz-feedback-panel">
        {success ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-income-bg text-income-text">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <p className="text-base font-bold text-brand">¡Gracias!</p>
            <p className="text-sm text-brand-mid text-center">
              Recibimos tu mensaje. Te contestamos pronto si hace falta.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 id="feedback-title" className="font-bold text-base text-ink-900">
                  Queremos saber qué piensas
                </h2>
                <p className="text-xs mt-0.5 text-brand-mid">
                  Tus comentarios nos ayudan a mejorar Fiza.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !sending && onClose()}
                disabled={sending}
                aria-label="Cerrar"
                className="text-lg leading-none min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-brand-mid disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Tipo */}
            <div className="flex gap-1 p-0.5 rounded-lg bg-brand-chip border border-brand-border mb-3">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={[
                    'flex-1 text-xs font-bold py-1.5 rounded-md transition-colors',
                    kind === opt.id ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Mensaje */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder={PLACEHOLDER[kind]}
              disabled={sending}
              className="fz-write-input w-full text-sm"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-brand-mid">
                {message.length} / 2000
              </span>
            </div>

            {state.kind === 'error' && (
              <p className="text-xs text-danger mt-1">{state.msg}</p>
            )}

            <div className="flex gap-2 justify-end mt-3">
              <button
                type="button"
                onClick={() => !sending && onClose()}
                disabled={sending}
                className="fz-btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || message.trim().length === 0}
                className="fz-btn-primary"
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
