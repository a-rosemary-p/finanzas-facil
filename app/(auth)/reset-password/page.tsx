'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Solo permitimos renderizar el form cuando el usuario llegó desde el link
  // de recuperación (evento PASSWORD_RECOVERY).
  useEffect(() => {
    const supabase = createClient()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    const timeout = setTimeout(() => {
      if (!ready) router.replace('/login')
    }, 1500)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 10) { setError('La contraseña debe tener al menos 10 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(translateAuthError(updateError.message, 'reset'))
      setLoading(false)
      return
    }

    await supabase.auth.signOut({ scope: 'global' })
    router.replace('/login')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Verificando enlace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fz-page-gradient-auth">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-white.png" alt="fiza" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-brand-border">
          <h2 className="font-bold text-lg mb-1 text-brand">
            Nueva contraseña
          </h2>
          <p className="text-sm mb-5 text-brand-mid">
            Elige una contraseña nueva para tu cuenta.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-brand">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                className="fz-auth-input"
              />
              <p className="text-xs text-brand-mid">Mínimo 10 caracteres</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-brand">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                className="fz-auth-input"
              />
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            <button type="submit" disabled={loading} className="fz-btn-auth-submit">
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
