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

  // OAuth Google. Comportamiento deseado:
  //   - User nuevo (email no existe): Supabase crea auth.users + dispara
  //     handle_new_user que llena profiles. Cae a /inicio.
  //   - User existente con email/password (mismo correo, email_confirmed):
  //     Supabase linkea Google como identity adicional al mismo user.id
  //     existente, sin crear duplicado. El profile no cambia. Cae a /inicio.
  //   - Si el botón "Cancelar" del consent screen de Google: Supabase
  //     redirige a /auth/confirm con error y cae al /login con flag.
  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/confirm?next=/inicio`,
        queryParams: {
          // Pide acceso a info básica (email, perfil) — sin scopes extra,
          // sin avatar URL access, etc. Solo lo necesario.
          access_type: 'online',
          prompt: 'select_account',
        },
      },
    })
    if (oauthError) {
      setError('No pudimos conectar con Google. Intenta de nuevo.')
      setLoading(false)
    }
    // Si no hubo error, el browser ya está navegando a Google — no
    // necesitamos hacer nada más; setLoading(false) no aplica porque
    // la página se va a recargar al volver.
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
      router.push('/inicio'); router.refresh()
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

          {/* OAuth Google — solo en login/register, no en "olvidé contraseña".
            * Si el usuario ya tiene cuenta con este email + password, Supabase
            * linkea Google al mismo user.id (no crea duplicado). Si es nuevo,
            * crea el row y dispara handle_new_user que siembra display_name
            * con el `full_name` de Google. */}
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-brand-border bg-white py-3 text-sm font-semibold text-brand min-h-[48px] transition-opacity disabled:opacity-60 hover:bg-brand-chip"
              >
                {/* Logo Google oficial — los 4 colores brand de Google */}
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </button>

              {/* Divider "o" */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-brand-border" />
                <span className="text-xs text-brand-muted">o</span>
                <div className="flex-1 h-px bg-brand-border" />
              </div>
            </>
          )}

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
