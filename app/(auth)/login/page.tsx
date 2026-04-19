'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  if (msg.length > 0 && msg.length < 120 && !msg.includes('{') && !msg.includes('undefined')) {
    return `Error: ${msg}`
  }
  return 'Ocurrió un error. Intenta de nuevo.'
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  )
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

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Por favor ingresa tu correo'); return }
      setLoading(true); setError('')
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` }
      )
      setLoading(false)
      if (resetError) { setError('No pudimos enviar el correo. Intenta de nuevo.') }
      else { setError(''); setRegistered(true) }
      return
    }

    if (!email.trim() || !password.trim()) { setError('Por favor ingresa tu correo y contraseña'); return }
    if (mode === 'register' && !nombre.trim()) { setError('Por favor ingresa tu nombre o el nombre de tu negocio'); return }
    if (mode === 'register' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (mode === 'register' && password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setLoading(true); setError('')
    const supabase = createClient()

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) { setError(traducirError(authError.message)); setLoading(false); return }
      router.push('/dashboard'); router.refresh()
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { display_name: nombre.trim() },
        },
      })
      if (authError) { setError(traducirError(authError.message)); setLoading(false); return }
      setRegistered(true); setLoading(false)
    }
  }

  /* ── Pantalla de "revisa tu correo" ── */
  if (registered) {
    const isForgot = mode === 'forgot'
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)' }}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-7xl mb-4">✉️</div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#fff' }}>
              {isForgot ? '¡Correo enviado!' : '¡Cuenta creada!'}
            </h1>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {isForgot ? 'Mandamos un link de restablecimiento a:' : 'Mandamos un link de confirmación a:'}
            </p>
            <p className="text-base font-bold mt-1" style={{ color: '#fff' }}>{email}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 w-full" style={{ border: '1px solid #D9E8D0' }}>
            <p className="text-sm text-center mb-1" style={{ color: '#578466' }}>
              {isForgot
                ? 'Haz clic en el link del correo para restablecer tu contraseña.'
                : 'Haz clic en el link del correo para activar tu cuenta.'}
            </p>
            <p className="text-xs text-center mb-5" style={{ color: '#6B8C78' }}>
              Si no lo ves, revisa tu carpeta de spam.
            </p>
            <button
              onClick={() => { setRegistered(false); switchMode('login') }}
              className="w-full text-white rounded-xl py-3.5 font-bold text-base min-h-[52px]"
              style={{ background: '#578466' }}
            >
              {isForgot ? 'Volver a entrar' : 'Ya confirmé — entrar →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-bold text-center" style={{ color: '#fff', fontSize: 'clamp(2.5rem, 13vw, 4.5rem)', fontFamily: 'var(--font-funnel-display)' }}>FinanzasFácil</h1>
          <p className="text-xl italic mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>Tus cuentas, sin cuentos</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #D9E8D0' }}>
          <h2 className="font-bold text-lg mb-5" style={{ color: '#578466' }}>
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Restablecer contraseña'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#578466' }}>Tu nombre o negocio</label>
                <input
                  type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan, Taquería El Güero"
                  autoComplete="name" disabled={loading} maxLength={50}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#D9E8D0', color: '#578466' }}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#578466' }}>Correo electrónico</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@negocio.com" autoComplete="email" disabled={loading}
                className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                style={{ borderColor: '#D9E8D0', color: '#578466' }}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: '#578466' }}>Contraseña</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-xs underline" style={{ color: '#6B8C78' }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#D9E8D0', color: '#578466' }}
                />
                {mode === 'register' && (
                  <p className="text-xs" style={{ color: '#6B8C78' }}>Mínimo 6 caracteres</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#578466' }}>Confirmar contraseña</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" disabled={loading}
                  className="border rounded-lg px-3 py-3 min-h-[44px] focus:outline-none focus:ring-2"
                  style={{ borderColor: '#D9E8D0', color: '#578466' }}
                />
              </div>
            )}

            {mode === 'forgot' && (
              <p className="text-sm" style={{ color: '#6B8C78' }}>
                Escribe tu correo y te mandamos un link para restablecer tu contraseña.
              </p>
            )}

            {error && <p className="text-sm" style={{ color: '#D0481A' }}>{error}</p>}

            <button
              type="submit" disabled={loading}
              className="text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px]"
              style={{ background: '#578466' }}
            >
              {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
            </button>
          </form>

          <p className="text-center text-sm mt-4" style={{ color: '#6B8C78' }}>
            {mode === 'forgot' ? (
              <>{'¿Ya recordaste? '}
                <button onClick={() => switchMode('login')} className="font-medium underline" style={{ color: '#578466' }}>Entrar</button>
              </>
            ) : mode === 'login' ? (
              <>{'¿No tienes cuenta? '}
                <button onClick={() => switchMode('register')} className="font-medium underline" style={{ color: '#578466' }}>Regístrate</button>
              </>
            ) : (
              <>{'¿Ya tienes cuenta? '}
                <button onClick={() => switchMode('login')} className="font-medium underline" style={{ color: '#578466' }}>Entra aquí</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)' }}>
        <p className="text-white text-sm">Cargando...</p>
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
