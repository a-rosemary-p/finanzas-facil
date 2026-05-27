'use client'

/**
 * Form de la página pública /eliminar-cuenta — v1.0.
 *
 * Para users que NO pueden acceder a su cuenta (olvidaron pass, cambiaron
 * correo, problema técnico). POST a /api/feedback con kind='eliminar_cuenta'
 * que envía email a admin para procesar manualmente.
 */

import { useState } from 'react'

export function EliminarCuentaForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Ingresa tu nombre.'); return }
    if (!email.trim()) { setError('Ingresa tu correo.'); return }
    if (reason.trim().length < 10) {
      setError('Cuéntanos brevemente por qué no puedes acceder (mín. 10 caracteres).')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'eliminar_cuenta',
          name: name.trim(),
          email: email.trim(),
          message: reason.trim(),
          website,  // honeypot
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'No se pudo enviar. Intenta de nuevo.')
        setSending(false)
        return
      }
      setSent(true)
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-brand-chip border border-brand-border rounded-lg px-4 py-3 text-sm text-brand">
        Solicitud recibida. Te confirmaremos por correo cuando esté procesada
        (máx. 7 días).
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-brand-mid">Tu nombre</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          required
          className="fz-input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-brand-mid">Correo asociado a tu cuenta de Fiza</span>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="fz-input"
          placeholder="ejemplo@correo.com"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-brand-mid">¿Por qué no puedes acceder?</span>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          required
          className="fz-input resize-y"
          placeholder="Ej: Olvidé mi contraseña y el correo de recuperación llega a una cuenta que ya no uso."
        />
      </label>

      {/* Honeypot: invisible, los bots lo llenan */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={e => setWebsite(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }}
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="py-2.5 rounded-xl text-sm font-bold bg-brand text-white disabled:opacity-50 mt-1"
      >
        {sending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
