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

  useEffect(() => {
    // Esperar a que Supabase establezca la sesión de recuperación
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      } else {
        // Sin sesión válida → regresar a login
        router.replace('/login')
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Éxito → ir al dashboard
    router.push('/dashboard')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: '#5A7A8A' }}>Verificando enlace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💰</div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3A' }}>
            FinanzasFácil
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #E0E0E0' }}>
          <h2 className="font-bold text-lg mb-1" style={{ color: '#1A2B3A' }}>
            Nueva contraseña
          </h2>
          <p className="text-sm mb-5" style={{ color: '#5A7A8A' }}>
            Elige una contraseña nueva para tu cuenta.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
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
                style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
              />
              <p className="text-xs" style={{ color: '#5A7A8A' }}>Mínimo 6 caracteres</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
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
                style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
              style={{ background: '#2E7D32' }}
            >
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
