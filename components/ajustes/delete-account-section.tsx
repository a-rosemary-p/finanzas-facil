'use client'

/**
 * DeleteAccountSection — botón "Eliminar mi cuenta" en /ajustes (v1.0).
 *
 * Requisito de Google Play Store: mecanismo in-app para borrar cuenta + URL
 * pública. La URL pública es /eliminar-cuenta (sin login).
 *
 * Flujo:
 *  1. Idle: botón pequeño "Eliminar mi cuenta" en color danger.
 *  2. Tap → expande aviso + segundo botón "Sí, entiendo, eliminar".
 *  3. Tap segundo → input "Escribe ELIMINAR para confirmar".
 *  4. Tap "Confirmar eliminación" → POST /api/profile/delete → signOut → /login.
 *
 * Sin paso intermedio "exportar mi data antes" — el user puede hacer Excel
 * export desde /reportes si quiere; aquí solo borramos.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { createClient } from '@/lib/supabase/client'

type Step = 'idle' | 'confirming' | 'typing' | 'deleting'

export function DeleteAccountSection() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  async function handleDelete() {
    setStep('deleting')
    setError('')
    try {
      const res = await fetchWithAuthRetry('/api/profile/delete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'No se pudo eliminar la cuenta. Contacta soporte.')
        setStep('typing')
        return
      }
      // Cerrar sesión client-side (el server ya lo hizo pero las cookies del
      // browser tienen su propio lifecycle).
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {}
      // Redirect a /login con mensaje de "cuenta eliminada".
      router.replace('/login?deleted=1')
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
      setStep('typing')
    }
  }

  // ── Idle ──────────────────────────────────────────────────────────────
  if (step === 'idle') {
    return (
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setStep('confirming')}
          className="text-xs font-medium text-danger underline"
        >
          Eliminar mi cuenta
        </button>
      </div>
    )
  }

  // ── Confirming (primer paso) ─────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <div className="bg-white rounded-2xl border border-danger/40 p-4 flex flex-col gap-3">
        <h3 className="font-bold text-sm text-danger">Eliminar tu cuenta</h3>
        <p className="text-xs text-brand-mid leading-relaxed">
          Esto borra <strong>todo</strong>: tus movimientos, proyectos, pendientes,
          recurrentes, categorías, perfil y sesión. <strong>No se puede deshacer.</strong>
        </p>
        <p className="text-xs text-brand-mid leading-relaxed">
          Si tienes plan Pro, tu suscripción se cancela al final del período actual.
          No emitimos reembolsos por días sin usar.
        </p>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setStep('typing')}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-danger text-white"
          >
            Sí, entiendo, continuar
          </button>
          <button
            type="button"
            onClick={() => setStep('idle')}
            className="flex-1 py-2 rounded-lg text-xs font-medium text-brand-mid bg-paper-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Typing ELIMINAR (segundo paso) ────────────────────────────────────
  const canConfirm = confirmText.trim().toUpperCase() === 'ELIMINAR' && step !== 'deleting'

  return (
    <div className="bg-white rounded-2xl border border-danger/40 p-4 flex flex-col gap-3">
      <h3 className="font-bold text-sm text-danger">Confirmación final</h3>
      <p className="text-xs text-brand-mid leading-relaxed">
        Escribe <strong>ELIMINAR</strong> en mayúsculas para confirmar.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        placeholder="ELIMINAR"
        autoComplete="off"
        className="fz-input"
        disabled={step === 'deleting'}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canConfirm}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-danger text-white disabled:opacity-40"
        >
          {step === 'deleting' ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
        </button>
        <button
          type="button"
          onClick={() => { setStep('idle'); setConfirmText(''); setError('') }}
          disabled={step === 'deleting'}
          className="flex-1 py-2.5 rounded-lg text-xs font-medium text-brand-mid bg-paper-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
