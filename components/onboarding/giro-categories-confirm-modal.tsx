'use client'

/**
 * Modal de confirmación de categorías para un giro determinado (v0.3).
 *
 * Reutiliza el visual del step `categories` del ProfilePromptModal pero
 * standalone — pensado para cuando el user cambia su giro desde Perfil
 * y necesita confirmar el nuevo set de categorías antes de persistir.
 *
 * Behavior:
 *  - "Confirmar"  → llama `onConfirm()`. El padre persiste el cambio.
 *  - "Cancelar"   → llama `onCancel()`. El padre revierte el draft.
 *
 * El modal no toca DB ni endpoint — es puramente presentacional. Si el
 * giro recibido no está en `GIRO_CATEGORIES`, no renderiza nada (el padre
 * debería detectar el caso y persistir directo sin abrir el modal).
 */

import { GIRO_CATEGORIES } from '@/lib/constants'

interface Props {
  giro: string
  /** Disabled para evitar doble-submit mientras el padre persiste. */
  submitting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function GiroCategoriesConfirmModal({ giro, submitting, onConfirm, onCancel }: Props) {
  const giroData = GIRO_CATEGORIES[giro]
  if (!giroData) return null

  return (
    <>
      <div
        aria-hidden="true"
        onClick={submitting ? undefined : onCancel}
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
        aria-labelledby="giro-confirm-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'auto',
          background: 'var(--paper)',
          borderRadius: 22,
          boxShadow: 'var(--sh-3)',
          padding: '24px 22px',
        }}
      >
        <p
          className="text-xs font-bold uppercase mb-2"
          style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
        >
          {giro}
        </p>
        <h2
          id="giro-confirm-title"
          className="font-bold mb-2"
          style={{ color: 'var(--brand)', fontSize: 20, lineHeight: 1.25 }}
        >
          Estas son tus nuevas categorías
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
          Fiza usará estas categorías para clasificar tus movimientos
          automáticamente desde ahora. Los movimientos viejos no cambian.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-xl p-3"
            style={{
              background: 'var(--income-bg)',
              border: '1px solid var(--income-border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase mb-2"
              style={{ color: 'var(--income-text)', letterSpacing: '0.1em' }}
            >
              Ingresos
            </p>
            <ul className="flex flex-col gap-1.5">
              {giroData.ingresos.map(c => (
                <li
                  key={c}
                  className="text-xs leading-snug"
                  style={{ color: 'var(--ink-900)' }}
                >
                  · {c}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="rounded-xl p-3"
            style={{
              background: 'var(--expense-bg)',
              border: '1px solid var(--expense-border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase mb-2"
              style={{ color: 'var(--expense-text)', letterSpacing: '0.1em' }}
            >
              Gastos
            </p>
            <ul className="flex flex-col gap-1.5">
              {giroData.gastos.map(c => (
                <li
                  key={c}
                  className="text-xs leading-snug"
                  style={{ color: 'var(--ink-900)' }}
                >
                  · {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="w-full rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: 'var(--brand)', minHeight: 48 }}
        >
          {submitting ? 'Guardando…' : 'Confirmar y guardar'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full text-xs font-medium mt-2 py-2 rounded-lg disabled:opacity-70"
          style={{ color: 'var(--brand-mid)', background: 'transparent' }}
        >
          Cancelar
        </button>
      </div>
    </>
  )
}
