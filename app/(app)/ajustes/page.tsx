'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { SettingsUpdate } from '@/types'
import { AppHeader } from '@/components/app-header'
import { WaveSection } from '@/components/ui/wave'
import { FeedbackModal } from '@/components/feedback-modal'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { translateAuthError } from '@/lib/auth-errors'

type EditingSection = 'cuenta' | 'password' | null

// ── Helpers de UI ───────────────────────────────────────────

function SectionCard({
  title, editing, onEdit, onSave, onCancel, saving, children, noEdit,
}: {
  title: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  children: React.ReactNode
  noEdit?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-border">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          {title}
        </p>
        {!noEdit && (
          editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={onCancel}
                className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px] text-brand-mid"
              >
                Cancelar
              </button>
              <button
                type="button" onClick={onSave} disabled={saving}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white min-h-[32px] transition-opacity disabled:opacity-60 bg-brand"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={onEdit}
              className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px] text-brand border border-brand-border bg-brand-chip"
            >
              Editar
            </button>
          )
        )}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col pt-3">
      <div className="flex items-start justify-between pb-1 gap-4">
        <div className="flex flex-col gap-0.5 flex-1">
          <p className="text-sm font-medium text-brand">{label}</p>
          {description && <p className="text-xs text-brand-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={[
            'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5',
            checked ? 'bg-brand' : 'bg-brand-border',
          ].join(' ')}
          aria-checked={checked}
          role="switch"
        >
          {/* El thumb se desliza con un translateX dinámico — clase
           * imposible sin enumerar valores. Dejamos esto inline (es state-driven). */}
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>
    </div>
  )
}

function EditInput({ label, value, onChange, type = 'text', placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'fz-auth-input min-h-[44px]',
          error ? 'border-danger' : '',
        ].join(' ')}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────
export default function AjustesPage() {
  const { profile, loading, updateSettings, updateEmail, updatePassword } = useAuth()
  const [editingSection, setEditingSection] = useState<EditingSection>(null)
  const [saving, setSaving] = useState(false)

  // Cuenta
  const [emailDraft, setEmailDraft] = useState('')
  const [emailPasswordDraft, setEmailPasswordDraft] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  // Contraseña
  const [pwDraft, setPwDraft] = useState({ current: '', new: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  // Stripe
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // Modal de comentarios — mismo patrón que /inicio.
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    if (!pwSuccess) return
    const t = setTimeout(() => setPwSuccess(''), 3000)
    return () => clearTimeout(t)
  }, [pwSuccess])

  async function toggleSetting(update: SettingsUpdate) {
    try {
      await updateSettings(update)
    } catch {
      // Si falla, el estado no se actualiza y el toggle vuelve a su posición.
    }
  }

  function openSection(section: EditingSection) {
    setEditingSection(section)
    setSaving(false)

    if (section === 'cuenta') {
      setEmailDraft(''); setEmailPasswordDraft(''); setEmailError(''); setEmailSuccess('')
    }
    if (section === 'password') {
      setPwDraft({ current: '', new: '', confirm: '' }); setPwError('')
    }
  }

  function closeSection() {
    setEditingSection(null)
    setSaving(false)
  }

  async function saveEmail() {
    if (!emailPasswordDraft.trim()) { setEmailError('Ingresa tu contraseña actual.'); return }
    if (!emailDraft.trim()) { setEmailError('Ingresa el nuevo correo.'); return }
    setSaving(true)
    setEmailError('')
    try {
      await updateEmail(emailDraft.trim(), emailPasswordDraft.trim())
      setEmailSuccess(`Te enviamos un correo a ${emailDraft.trim()} para confirmar el cambio.`)
      closeSection()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'wrong_password') setEmailError('La contraseña no es correcta.')
      else if (msg.toLowerCase().includes('invalid')) setEmailError('El correo no es válido.')
      else setEmailError('No se pudo actualizar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const savePassword = useCallback(async () => {
    setPwError('')
    if (pwDraft.new.length < 10) { setPwError('La nueva contraseña debe tener al menos 10 caracteres.'); return }
    if (pwDraft.new !== pwDraft.confirm) { setPwError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      await updatePassword(pwDraft.current, pwDraft.new)
      setPwSuccess('Contraseña actualizada correctamente.')
      closeSection()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'wrong_password') setPwError('La contraseña actual no es correcta.')
      else setPwError(translateAuthError(msg, 'reset'))
    } finally {
      setSaving(false)
    }
  }, [pwDraft, updatePassword])

  const handleUpgrade = useCallback(async () => {
    setCheckoutLoading(true)
    await startProCheckout()
    setCheckoutLoading(false)
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetchWithAuthRetry('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else if (data.error) window.alert(data.error)
    } catch { window.alert('No se pudo conectar. Intenta de nuevo.') }
    finally { setPortalLoading(false) }
  }, [])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    )
  }

  const isCuentaEditing = editingSection === 'cuenta'
  const isPwEditing = editingSection === 'password'

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4 fz-pad-safe-bottom">

        {/* Título + subtítulo + wave divider — patrón compartido con /pendientes. */}
        <div>
          <h1 className="font-bold text-lg text-brand">Ajustes</h1>
          <p className="text-sm mt-0.5 text-brand-mid">
            Tu cuenta, tu suscripción y tus preferencias.
          </p>
          <div className="mt-3">
            <WaveSection />
          </div>
        </div>

        {/* ── 1. Suscripción (movida al tope en v0.3 — es lo más
             accionable) ── */}
        <SectionCard title="Suscripción" editing={false}
          onEdit={() => {}} onSave={() => {}} onCancel={() => {}} noEdit>
          {profile.plan === 'free' ? (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                  Plan actual
                </p>
                <p className="text-sm font-semibold text-brand">
                  Free — 10 movimientos por día
                </p>
              </div>
              <button
                onClick={handleUpgrade} disabled={checkoutLoading}
                className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[48px] transition-opacity disabled:opacity-60 bg-brand"
              >
                {checkoutLoading
                  ? 'Redirigiendo...'
                  : profile?.trialUsed
                    ? 'Activa Pro — $49/mes'
                    : 'Prueba Pro gratis 30 días — $49/mes después'}
              </button>
              <p className="text-xs text-center text-brand-muted">
                Historial limitado a 30 días · Movimientos limitados a 10/día
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                  Plan actual
                </p>
                <p className="text-sm font-semibold text-brand">
                  Pro ✓ — Movimientos ilimitados
                </p>
              </div>
              <button
                onClick={handlePortal} disabled={portalLoading}
                className="w-full rounded-xl py-3 font-medium text-sm min-h-[48px] border border-brand-border text-brand-mid bg-brand-chip transition-opacity disabled:opacity-60"
              >
                {portalLoading ? '...' : 'Gestionar suscripción'}
              </button>
              <p className="text-xs text-center text-brand-muted">
                Cancela cuando quieras desde el portal de Stripe.
              </p>
            </div>
          )}
        </SectionCard>

        {/* ── 2. Preferencias ── */}
        <SectionCard title="Preferencias" editing={false}
          onEdit={() => {}} onSave={() => {}} onCancel={() => {}} noEdit>
          <div className="flex flex-col pt-1">
            {/* Moneda preferida */}
            <div className="flex flex-col gap-2 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Moneda preferida
              </p>
              <div className="flex gap-2">
                <div className="flex-1 py-2.5 rounded-xl text-sm font-bold border flex items-center justify-center min-h-[44px] bg-brand text-white border-brand">
                  MXN
                </div>
                <div className="flex-1 py-2.5 rounded-xl text-sm font-bold border flex flex-col items-center justify-center min-h-[44px] gap-0.5 bg-paper-2 text-ink-300 border-ink-100">
                  <span>USD</span>
                  <span className="text-[10px] font-medium text-ink-300">Próximamente</span>
                </div>
              </div>
            </div>

            {/* Defaults para los chips de filtro de /movimientos. Cuando el
             * user entra a /movimientos, los chips de "Inversiones" y
             * "Pendientes" arrancan activos/inactivos según estos toggles. */}
            <ToggleRow
              label="Incluir inversiones por default"
              description="En Movimientos, el chip de Inversiones empieza activo."
              checked={profile.mostrarInversiones ?? false}
              onChange={v => toggleSetting({ mostrarInversiones: v })}
            />
            <ToggleRow
              label="Incluir pendientes por default"
              description="En Movimientos, el chip de Pendientes empieza activo."
              checked={profile.mostrarPendientes ?? true}
              onChange={v => toggleSetting({ mostrarPendientes: v })}
            />
          </div>
        </SectionCard>

        {/* ── 3. Cuenta ── */}
        <SectionCard
          title="Cuenta"
          editing={isCuentaEditing}
          onEdit={() => openSection('cuenta')}
          onSave={saveEmail}
          onCancel={closeSection}
          saving={saving}
        >
          {isCuentaEditing ? (
            <div className="flex flex-col gap-4 pt-2">
              <EditInput
                label="Contraseña actual"
                type="password"
                value={emailPasswordDraft}
                onChange={setEmailPasswordDraft}
                placeholder="••••••••"
              />
              <EditInput
                label="Nuevo correo electrónico"
                type="email"
                value={emailDraft}
                onChange={setEmailDraft}
                placeholder="nuevo@correo.com"
                error={emailError}
              />
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-1 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                  Correo electrónico
                </p>
                <p className="text-sm text-brand">{profile.email}</p>
              </div>
              {emailSuccess && (
                <p className="text-xs py-2 text-brand">{emailSuccess}</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 4. Contraseña ── */}
        <SectionCard
          title="Contraseña"
          editing={isPwEditing}
          onEdit={() => openSection('password')}
          onSave={savePassword}
          onCancel={closeSection}
          saving={saving}
        >
          {isPwEditing ? (
            <div className="flex flex-col gap-4 pt-2">
              <EditInput
                label="Contraseña actual"
                type="password"
                value={pwDraft.current}
                onChange={v => setPwDraft(d => ({ ...d, current: v }))}
                placeholder="••••••••"
              />
              <EditInput
                label="Nueva contraseña"
                type="password"
                value={pwDraft.new}
                onChange={v => setPwDraft(d => ({ ...d, new: v }))}
                placeholder="Mínimo 10 caracteres"
              />
              <EditInput
                label="Confirmar nueva contraseña"
                type="password"
                value={pwDraft.confirm}
                onChange={v => setPwDraft(d => ({ ...d, confirm: v }))}
                placeholder="Repite la nueva contraseña"
                error={pwError}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Contraseña
              </p>
              <p className="text-sm text-brand">••••••••••••</p>
              {pwSuccess && (
                <p className="text-xs mt-1 text-brand">{pwSuccess}</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Comentarios — abre FeedbackModal. Mismo patrón que /inicio. */}
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-brand-mid"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Comentarios
          </button>
        </div>

      </main>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}
