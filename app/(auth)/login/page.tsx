'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'

type Mode = 'login' | 'register' | 'forgot'

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
    if (mode === 'register' && password.length < 10) { setError('La contraseña debe tener al menos 10 caracteres'); return }
    if (mode === 'register' && password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setLoading(true); setError('')
    const supabase = createClient()

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) { setError(translateAuthError(authError.message, mode)); setLoading(false); return }
      router.push('/registros'); router.refresh()
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { display_name: nombre.trim() },
        },
      })
      if (authError) { setError(translateAuthError(authError.message, mode)); setLoading(false); return }
      setRegistered(true); setLoading(false)
    }
  }

  /* ── Pantalla de "revisa tu correo" ── */
  if (registered) {
    const isForgot = mode === 'forgot'
    return (
      <div className="min-h-screen flex items-center justify-center p-4 fz-page-gradient-auth">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-7xl mb-4">✉️</div>
            <h1 className="text-3xl font-bold mb-2 text-white">
              {isForgot ? '¡Correo enviado!' : '¡Cuenta creada!'}
            </h1>
            <p className="text-base text-white/85">
              {isForgot ? 'Mandamos un link de restablecimiento a:' : 'Mandamos un link de confirmación a:'}
            </p>
            <p className="text-base font-bold mt-1 text-white">{email}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 w-full border border-brand-border">
            <p className="text-sm text-center mb-1 text-brand">
              {isForgot
                ? 'Haz clic en el link del correo para restablecer tu contraseña.'
                : 'Haz clic en el link del correo para activar tu cuenta.'}
            </p>
            <p className="text-xs text-center mb-5 text-brand-mid">
              Si no lo ves, revisa tu carpeta de spam.
            </p>
            <button
              onClick={() => { setRegistered(false); switchMode('login') }}
              className="fz-btn-auth-submit w-full"
            >
              {isForgot ? 'Volver a entrar' : 'Ya confirmé — entrar →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fz-page-gradient-auth">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-white.png" alt="fiza" className="h-16 w-auto" />
          <p className="text-xl italic mt-3 text-white/85 text-center">Tus cuentas, sin cuentos</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-brand-border">
          <h2 className="font-bold text-lg mb-5 text-brand">
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Restablecer contraseña'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brand">Tu nombre o negocio</label>
                <input
                  type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan, Taquería El Güero"
                  autoComplete="name" disabled={loading} maxLength={50}
                  className="fz-auth-input"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-brand">Correo electrónico</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@negocio.com" autoComplete="email" disabled={loading}
                className="fz-auth-input"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-brand">Contraseña</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-xs underline text-brand-mid">
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                  className="fz-auth-input"
                />
                {mode === 'register' && (
                  <p className="text-xs text-brand-mid">Mínimo 10 caracteres</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brand">Confirmar contraseña</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" disabled={loading}
                  className="fz-auth-input"
                />
              </div>
            )}

            {mode === 'forgot' && (
              <p className="text-sm text-brand-mid">
                Escribe tu correo y te mandamos un link para restablecer tu contraseña.
              </p>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={loading} className="fz-btn-auth-submit">
              {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
            </button>
          </form>

          <p className="text-center text-sm mt-4 text-brand-mid">
            {mode === 'forgot' ? (
              <>{'¿Ya recordaste? '}
                <button onClick={() => switchMode('login')} className="font-medium underline text-brand">Entrar</button>
              </>
            ) : mode === 'login' ? (
              <>{'¿No tienes cuenta? '}
                <button onClick={() => switchMode('register')} className="font-medium underline text-brand">Regístrate</button>
              </>
            ) : (
              <>{'¿Ya tienes cuenta? '}
                <button onClick={() => switchMode('login')} className="font-medium underline text-brand">Entra aquí</button>
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
      <div className="min-h-screen flex items-center justify-center fz-page-gradient-auth">
        <p className="text-white text-sm">Cargando...</p>
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
