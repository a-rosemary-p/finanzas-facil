'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register' | 'forgot'

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'Correo o contraseña incorrectos'
  if (m.includes('already registered') || m.includes('already exists') || m.includes('email already') || m.includes('already been registered')) return 'Este correo ya está registrado. ¿Quieres entrar?'
  if (m.includes('password should be at least') || m.includes('password must be')) return 'La contraseña debe tener al menos 6 caracteres'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('security purposes') || m.includes('over_email_send_rate_limit') || m.includes('email rate limit')) return 'Demasiados intentos. Espera 60 segundos e intenta de nuevo.'
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('too many')) return 'Demasiados intentos. Espera un momento.'
  if (m.includes('unable to validate email') || m.includes('valid email') || m.includes('invalid email')) return 'El formato del correo no es válido'
  if (m.includes('signup') && m.includes('disabled')) return 'El registro no está habilitado en este momento.'
  if (m.includes('database error') || m.includes('unexpected error')) return 'Error en el servidor. Intenta de nuevo en un momento.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  // Fallback: si el mensaje no es técnico mostrarlo, si es un código interno usar genérico
  if (msg.length > 0 && msg.length < 120 && !msg.includes('{') && !msg.includes('undefined')) {
    return `Error: ${msg}`
  }
  return 'Ocurrió un error. Intenta de nuevo.'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setRegistered(false)
    setConfirmPassword('')
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
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` }
      )
      setLoading(false)
      if (resetError) {
        setError('No pudimos enviar el correo. Intenta de nuevo.')
      } else {
        setError('')
        // Reutilizamos el estado registered para mostrar la pantalla de "revisa tu correo"
        setRegistered(true)
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
    if (mode === 'register' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError('')

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
      setRegistered(true)
      setLoading(false)
    }
  }

  /* ── Pantalla de "revisa tu correo" (registro o reset) ── */
  if (registered) {
    const isForgot = mode === 'forgot'
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #2CB03B 0%, #D6EDC2 100%)' }}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-7xl mb-4">✉️</div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#fff' }}>
              {isForgot ? '¡Correo enviado!' : '¡Cuenta creada!'}
            </h1>
            <p className="text-base" style={{ color: '#E8F5E9' }}>
              {isForgot ? 'Mandamos un link de restablecimiento a:' : 'Mandamos un link de confirmación a:'}
            </p>
            <p className="text-base font-bold mt-1" style={{ color: '#fff' }}>
              {email}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 w-full" style={{ border: '1px solid #E0E0E0' }}>
            <p className="text-sm text-center mb-1" style={{ color: '#1A2B3A' }}>
              {isForgot
                ? 'Haz clic en el link del correo para restablecer tu contraseña.'
                : 'Haz clic en el link del correo para activar tu cuenta.'}
            </p>
            <p className="text-xs text-center mb-5" style={{ color: '#5A7A8A' }}>
              Si no lo ves, revisa tu carpeta de spam.
            </p>
            <button
              onClick={() => { setRegistered(false); switchMode('login') }}
              className="w-full text-white rounded-xl py-3.5 font-bold text-base min-h-[52px]"
              style={{ background: '#2E7D32' }}
            >
              {isForgot ? 'Volver a entrar' : 'Ya confirmé — entrar →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #2CB03B 0%, #D6EDC2 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💰</div>
          <h1 className="text-5xl font-bold" style={{ color: '#fff' }}>
            FinanzasFácil
          </h1>
          <p className="text-xl italic mt-2" style={{ color: '#fff' }}>
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

            {/* Confirmar contraseña — solo en registro */}
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#1A2B3A' }}>
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
                />
              </div>
            )}

            {/* Descripción en modo forgot */}
            {mode === 'forgot' && (
              <p className="text-sm" style={{ color: '#5A7A8A' }}>
                Escribe tu correo y te mandamos un link para restablecer tu contraseña.
              </p>
            )}

            {error && <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>}

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
