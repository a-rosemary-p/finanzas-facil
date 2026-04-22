'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import type { SettingsUpdate } from '@/types'

type EditingSection = 'preferencias' | 'cuenta' | 'password' | null

// ── Helpers de UI ───────────────────────────────────────────

function SectionCard({
  title,
  editing,
  onEdit,
  onSave,
  onCancel,
  saving,
  children,
  noEdit,
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
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--brand-border)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>
          {title}
        </p>
        {!noEdit && (
          editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={onCancel}
                className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px]"
                style={{ color: 'var(--brand-mid)' }}
              >
                Cancelar
              </button>
              <button
                type="button" onClick={onSave} disabled={saving}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white min-h-[32px] transition-opacity disabled:opacity-60"
                style={{ background: 'var(--brand)' }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={onEdit}
              className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px]"
              style={{ color: 'var(--brand)', border: '1px solid var(--brand-border)', background: 'var(--brand-chip)' }}
            >
              ✏️ Editar
            </button>
          )
        )}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}

function ReadRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--brand)' : 'var(--brand-muted)' }}>{value || '—'}</p>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between py-3 gap-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
      <div className="flex flex-col gap-0.5 flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>{label}</p>
        {description && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5"
        style={{ background: checked ? 'var(--brand)' : 'var(--brand-border)' }}
        aria-checked={checked}
        role="switch"
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

function EditInput({ label, value, onChange, type = 'text', placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 min-h-[44px]"
        style={{
          borderColor: error ? 'var(--danger)' : 'var(--brand-border)',
          color: 'var(--brand)',
        }}
      />
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────
export default function AjustesPage() {
  const { profile, loading, logout, updateSettings, updateEmail, updatePassword } = useAuth()
  const [editingSection, setEditingSection] = useState<EditingSection>(null)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Preferencias draft ──
  const [prefDraft, setPrefDraft] = useState<SettingsUpdate>({
    monedaPreferida: 'MXN',
    mostrarInversiones: false,
    mostrarPendientes: true,
  })

  // ── Cuenta (email) draft ──
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  // ── Contraseña draft ──
  const [pwDraft, setPwDraft] = useState({ current: '', new: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  // ── Stripe ──
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Timer para mensaje de éxito de contraseña
  useEffect(() => {
    if (!pwSuccess) return
    const t = setTimeout(() => setPwSuccess(''), 3000)
    return () => clearTimeout(t)
  }, [pwSuccess])

  function openSection(section: EditingSection) {
    // Si ya hay otra sección abierta, la cerramos sin guardar
    setEditingSection(section)
    setSaving(false)

    if (section === 'preferencias' && profile) {
      setPrefDraft({
        monedaPreferida: profile.monedaPreferida ?? 'MXN',
        mostrarInversiones: profile.mostrarInversiones ?? false,
        mostrarPendientes: profile.mostrarPendientes ?? true,
      })
    }
    if (section === 'cuenta' && profile) {
      setEmailDraft(profile.email)
      setEmailError('')
      setEmailSuccess('')
    }
    if (section === 'password') {
      setPwDraft({ current: '', new: '', confirm: '' })
      setPwError('')
    }
  }

  function closeSection() {
    setEditingSection(null)
    setSaving(false)
  }

  // ── Guardar preferencias ──
  async function savePreferencias() {
    setSaving(true)
    try {
      await updateSettings(prefDraft)
      closeSection()
    } catch {
      // error silencioso — el botón vuelve a habilitarse
    } finally {
      setSaving(false)
    }
  }

  // ── Guardar email ──
  async function saveEmail() {
    if (!emailDraft.trim() || emailDraft === profile?.email) {
      closeSection(); return
    }
    setSaving(true)
    setEmailError('')
    try {
      await updateEmail(emailDraft.trim())
      setEmailSuccess(`Te enviamos un correo a ${emailDraft.trim()} para confirmar el cambio.`)
      setEditingSection(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('invalid')) {
        setEmailError('El correo no es válido.')
      } else {
        setEmailError('No se pudo actualizar. Intenta de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Guardar contraseña ──
  const savePassword = useCallback(async () => {
    setPwError('')
    if (pwDraft.new.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (pwDraft.new !== pwDraft.confirm) {
      setPwError('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    try {
      await updatePassword(pwDraft.current, pwDraft.new)
      setPwSuccess('Contraseña actualizada correctamente.')
      closeSection()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'wrong_password') {
        setPwError('La contraseña actual no es correcta.')
      } else {
        setPwError('No se pudo actualizar. Intenta de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }, [pwDraft, updatePassword])

  const handleUpgrade = useCallback(async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else if (data.error) window.alert(data.error)
    } catch { window.alert('No se pudo conectar. Intenta de nuevo.') }
    finally { setCheckoutLoading(false) }
  }, [])

  const handlePortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else if (data.error) window.alert(data.error)
    } catch { window.alert('No se pudo conectar. Intenta de nuevo.') }
    finally { setPortalLoading(false) }
  }, [])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    )
  }

  const isPrefEditing = editingSection === 'preferencias'
  const isCuentaEditing = editingSection === 'cuenta'
  const isPwEditing = editingSection === 'password'

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>

      {/* Header */}
      <header
        className="bg-white sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          borderBottom: '1px solid var(--brand-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px',
          minHeight: '56px',
        }}
      >
        <a href="/dashboard">
          <img src="/logo-green.png" alt="fiza" style={{ height: '32px', width: 'auto' }} />
        </a>

        {/* Menú hamburger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex flex-col items-center justify-center gap-[5px] rounded-lg min-h-[44px] min-w-[44px] transition-colors"
            style={{ background: menuOpen ? 'var(--brand-chip)' : 'transparent', border: '1px solid var(--brand-border)' }}
            aria-label="Menú"
          >
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
              style={{ border: '1px solid var(--brand-border)', top: '100%' }}
            >
              {[
                { icon: '🏠', label: 'Dashboard', href: '/dashboard' },
                { icon: '👤', label: 'Perfil', href: '/perfil' },
                { icon: '⚙️', label: 'Ajustes', href: '/ajustes' },
                { icon: '📊', label: 'Reportes', href: '/reportes' },
              ].map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--brand-chip)] min-h-[48px]"
                  style={{ color: 'var(--brand)' }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
              <div style={{ borderTop: '1px solid var(--brand-border)' }}>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); logout() }}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full transition-colors hover:bg-[var(--danger-bg)] min-h-[48px]"
                  style={{ color: 'var(--danger)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Salir</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >

        {/* ── 1. Preferencias ── */}
        <SectionCard
          title="Preferencias"
          editing={isPrefEditing}
          onEdit={() => openSection('preferencias')}
          onSave={savePreferencias}
          onCancel={closeSection}
          saving={saving}
        >
          {isPrefEditing ? (
            <div className="flex flex-col gap-5 pt-2">
              {/* Moneda */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Moneda preferida
                </p>
                <div className="flex gap-2">
                  {(['MXN', 'USD'] as const).map(m => (
                    <button
                      key={m} type="button"
                      onClick={() => setPrefDraft(d => ({ ...d, monedaPreferida: m }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors min-h-[44px]"
                      style={prefDraft.monedaPreferida === m
                        ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                        : { background: 'var(--brand-chip)', color: 'var(--brand)', borderColor: 'var(--brand-border)' }
                      }
                    >
                      {m === 'MXN' ? '🇲🇽 MXN' : '🇺🇸 USD'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <ToggleRow
                label="Mostrar inversiones por default"
                description="Activos a largo plazo. Si está apagado, puedes activarlos temporalmente en el dashboard."
                checked={prefDraft.mostrarInversiones ?? false}
                onChange={v => setPrefDraft(d => ({ ...d, mostrarInversiones: v }))}
              />
              <ToggleRow
                label="Mostrar pendientes por default"
                description="Compromisos futuros. Si está apagado, no aparecen en el historial al ver 'Todos'."
                checked={prefDraft.mostrarPendientes ?? true}
                onChange={v => setPrefDraft(d => ({ ...d, mostrarPendientes: v }))}
              />
            </div>
          ) : (
            <div>
              <ReadRow
                label="Moneda preferida"
                value={profile.monedaPreferida === 'USD' ? '🇺🇸 USD — Dólar americano' : '🇲🇽 MXN — Peso mexicano'}
              />
              <ReadRow
                label="Mostrar inversiones en el dashboard"
                value={profile.mostrarInversiones ? 'Sí' : 'No (activar con el toggle)'}
              />
              <div className="flex flex-col gap-1 py-3">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Mostrar pendientes en el dashboard
                </p>
                <p className="text-sm" style={{ color: 'var(--brand)' }}>
                  {profile.mostrarPendientes ?? true ? 'Sí' : 'No'}
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── 2. Cuenta ── */}
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
                label="Correo electrónico"
                type="email"
                value={emailDraft}
                onChange={setEmailDraft}
                placeholder="tu@correo.com"
                error={emailError}
              />
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-1 py-3">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Correo electrónico
                </p>
                <p className="text-sm" style={{ color: 'var(--brand)' }}>{profile.email}</p>
              </div>
              {emailSuccess && (
                <p className="text-xs py-2" style={{ color: 'var(--brand)' }}>✅ {emailSuccess}</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 3. Suscripción ── */}
        <SectionCard
          title="Suscripción"
          editing={false}
          onEdit={() => {}}
          onSave={() => {}}
          onCancel={() => {}}
          noEdit
        >
          {profile.plan === 'free' ? (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Plan actual
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  Free — 10 movimientos por día
                </p>
              </div>
              <button
                onClick={handleUpgrade} disabled={checkoutLoading}
                className="w-full text-white rounded-xl py-3 font-bold text-sm min-h-[48px] transition-opacity disabled:opacity-60"
                style={{ background: 'var(--brand)' }}
              >
                {checkoutLoading ? 'Redirigiendo...' : 'Prueba Pro gratis 30 días — $49/mes después'}
              </button>
              <p className="text-xs text-center" style={{ color: 'var(--brand-muted)' }}>
                Historial limitado a 30 días · Movimientos limitados a 10/día
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Plan actual
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  Pro ✓ — Movimientos ilimitados
                </p>
              </div>
              <button
                onClick={handlePortal} disabled={portalLoading}
                className="w-full rounded-xl py-3 font-medium text-sm min-h-[48px] border transition-opacity disabled:opacity-60"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
              >
                {portalLoading ? '...' : 'Gestionar suscripción'}
              </button>
              <p className="text-xs text-center" style={{ color: 'var(--brand-muted)' }}>
                Cancela cuando quieras desde el portal de Stripe.
              </p>
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
                placeholder="Mínimo 6 caracteres"
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
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                Contraseña
              </p>
              <p className="text-sm" style={{ color: 'var(--brand)' }}>••••••••••••</p>
              {pwSuccess && (
                <p className="text-xs mt-1" style={{ color: 'var(--brand)' }}>✅ {pwSuccess}</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Volver */}
        <a
          href="/dashboard"
          className="text-sm font-medium py-3 rounded-xl min-h-[44px] flex items-center justify-center transition-colors"
          style={{ color: 'var(--brand-mid)', background: 'rgba(255,255,255,0.6)' }}
        >
          ← Volver al dashboard
        </a>

      </main>
    </div>
  )
}
