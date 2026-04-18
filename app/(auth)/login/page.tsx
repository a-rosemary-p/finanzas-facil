'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register' | 'forgot'

function traducirError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos'
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('User already registered')) return 'Este correo ya está registrado. ¿Quieres entrar?'
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres'
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Espera un momento.'
  if (msg.includes('Unable to validate email address')) return 'El formato del correo no es válido'
  return 'Ocurrió un error. Intenta de nuevo.'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setSuccessMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Modo "olvidé mi contraseña"
    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Por favor ingresa tu correo')
        return
      }
      setLoading(true)
      setError('')
      setSuccessMsg('')
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/confirm` }
      )
      setLoading(false)
      if (resetError) {
        setError('No pudimos enviar el correo. Intenta de nuevo.')
      } else {
        setSuccessMsg('¡Listo! Revisa tu correo — te mandamos un link para restablecer tu contraseña.')
      }
      return
    }

    if (!email.trim() || !password.trim()) {
      setError('Por favor ingresa tu correo y contraseña')
      return
    }
    if (mode === 'register' && !nombre.trim()) {
      setError('Por favor ingresa tu nombre o el nombre de tu negocio')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')

    const supabase = createClient()

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(traducirError(authError.message))
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { display_name: nombre.trim() },
        },
      })
      if (authError) {
        setError(traducirError(authError.message))
        setLoading(false)
        return
      }
      setSuccessMsg('¡Listo! Revisa tu correo — te mandamos un link para confirmar tu cuenta.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #0F1F2E 0%, #1A3A28 45%, #2E7D32 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💰</div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3A' }}>
            FinanzasFácil
          </h1>
          <p className="text-sm italic mt-1" style={{ color: '#5A7A8A' }}>
            Tus cuentas, sin cuentos
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #E0E0E0' }}>
          <h2 className="font-bold text-lg mb-5" style={{ color: '#1A2B3A' }}>
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Restablecer contraseña'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Nombre — solo en registro */}
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
                  Tu nombre o negocio
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan, Taquería El Güero"
                  autoComplete="name"
                  disabled={loading}
                  maxLength={50}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
                />
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@negocio.com"
                autoComplete="email"
                disabled={loading}
                className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
              />
            </div>

            {/* Contraseña — oculta en modo forgot */}
            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
                    Contraseña
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs underline"
                      style={{ color: '#5A7A8A' }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
                />
                {mode === 'register' && (
                  <p className="text-xs" style={{ color: '#5A7A8A' }}>Mínimo 6 caracteres</p>
                )}
              </div>
            )}

            {/* Descripción en modo forgot */}
            {mode === 'forgot' && (
              <p className="text-sm" style={{ color: '#5A7A8A' }}>
                Escribe tu correo y te mandamos un link para restablecer tu contraseña.
              </p>
            )}

            {error && <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>}
            {successMsg && <p className="text-sm font-medium" style={{ color: '#2E7D32' }}>{successMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
              style={{ background: '#2E7D32' }}
            >
              {loading
                ? 'Un momento...'
                : mode === 'login'
                  ? 'Entrar'
                  : mode === 'register'
                    ? 'Crear cuenta'
                    : 'Enviar link'}
            </button>
          </form>

          <p className="text-center text-sm mt-4" style={{ color: '#5A7A8A' }}>
            {mode === 'forgot' ? (
              <>
                {'¿Ya recordaste? '}
                <button
                  onClick={() => switchMode('login')}
                  className="font-medium underline"
                  style={{ color: '#2E7D32' }}
                >
                  Entrar
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                {'¿No tienes cuenta? '}
                <button
                  onClick={() => switchMode('register')}
                  className="font-medium underline"
                  style={{ color: '#2E7D32' }}
                >
                  Regístrate
                </button>
              </>
            ) : (
              <>
                {'¿Ya tienes cuenta? '}
                <button
                  onClick={() => switchMode('login')}
                  className="font-medium underline"
                  style={{ color: '#2E7D32' }}
                >
                  Entra aquí
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
