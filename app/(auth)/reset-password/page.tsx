'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Solo permitimos renderizar el form cuando el usuario llegó desde el link
  // de recuperación (evento PASSWORD_RECOVERY). Una sesión normal no debería
  // poder cambiar contraseña sin pasar por /ajustes (que pide contraseña actual).
  useEffect(() => {
    const supabase = createClient()

    // Listener PRIMERO — así capturamos el PASSWORD_RECOVERY aunque la
    // sesión se hidrate en el mismo tick del mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Fallback: si Supabase ya procesó el link antes de registrar el listener,
    // solo confiamos en una sesión fresca (creada hace <5 min vía recovery).
    // Sin fresh-grace, damos 1.5s al listener y si no disparó, redirigimos.
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
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Tras cambio por recovery: invalidar TODAS las sesiones (incluyendo esta)
    // y regresar a login. Un token robado que llegó por esta ruta también se
    // revoca así.
    await supabase.auth.signOut({ scope: 'global' })
    router.replace('/login')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Verificando enlace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)' }}>
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <img src="/logo-white.png" alt="fiza" style={{ height: '64px', width: 'auto' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid var(--brand-border)' }}>
          <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--brand)' }}>
            Nueva contraseña
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--brand-mid)' }}>
            Elige una contraseña nueva para tu cuenta.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
              />
              <p className="text-xs" style={{ color: 'var(--brand-mid)' }}>Mínimo 6 caracteres</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
              style={{ background: 'var(--brand)' }}
            >
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
