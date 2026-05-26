'use client'

/**
 * Toast — sistema minimal de notificaciones in-UI para reemplazar window.alert.
 *
 * Patrón: provider en root + hook useToast(). Toast aparece en bottom-center,
 * desaparece auto en 5s (o cuando el user lo cierra). Stack máximo 3.
 *
 * Uso:
 *   const { show } = useToast()
 *   show({ kind: 'info', message: 'Proyecto reabierto' })
 *   show({ kind: 'warning', message: 'Tienes 3 recurrentes pausados', duration: 8000 })
 *
 * No bloquea — el usuario puede seguir interactuando.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type ToastKind = 'info' | 'success' | 'warning' | 'error'

interface ToastItem {
  id: string
  kind: ToastKind
  message: string
  duration: number  // ms; 0 = no auto-dismiss
}

interface ShowOpts {
  kind?: ToastKind
  message: string
  duration?: number
}

interface ToastContextValue {
  show: (opts: ShowOpts) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_STACK = 3
const DEFAULT_DURATION = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((opts: ShowOpts) => {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
    const next: ToastItem = {
      id,
      kind: opts.kind ?? 'info',
      message: opts.message,
      duration: opts.duration ?? DEFAULT_DURATION,
    }
    setItems(prev => {
      const updated = [...prev, next]
      // Si excede el stack, eliminamos los más viejos.
      return updated.length > MAX_STACK ? updated.slice(-MAX_STACK) : updated
    })
  }, [])

  // Auto-dismiss timers (uno por toast, montado solo cuando el item se agrega).
  useEffect(() => {
    if (items.length === 0) return
    const timers = items
      .filter(t => t.duration > 0)
      .map(t => window.setTimeout(() => dismiss(t.id), t.duration))
    return () => { timers.forEach(t => window.clearTimeout(t)) }
  }, [items, dismiss])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-6 flex flex-col gap-2 z-[60] pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-live="polite"
      >
        {items.map(t => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback silencioso si se llama fuera del provider — log + no-op.
    // En lugar de throw que rompería renders, log y devolvemos no-op.
    return {
      show: (opts) => console.warn('[useToast] sin ToastProvider —', opts.message),
    }
  }
  return ctx
}

const KIND_CLASSES: Record<ToastKind, string> = {
  info:    'bg-brand text-white',
  success: 'bg-brand text-white',
  warning: 'bg-pending-bg text-pending-text border border-pending-border',
  error:   'bg-danger text-white',
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div
      className={[
        'pointer-events-auto rounded-xl shadow-md px-4 py-2.5 flex items-center gap-2 max-w-[min(420px,calc(100vw-2rem))]',
        KIND_CLASSES[item.kind],
      ].join(' ')}
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="text-sm flex-1 leading-snug">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-base leading-none opacity-70 hover:opacity-100 px-1"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  )
}
