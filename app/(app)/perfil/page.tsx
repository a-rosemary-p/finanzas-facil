'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { GIROS, ESTADOS_MX } from '@/lib/constants'
import type { ProfileUpdate } from '@/types'
import { AppHeader } from '@/components/app-header'
import { startProCheckout } from '@/lib/upgrade-to-pro'

// ── Campo en modo lectura ───────────────────────────────────
function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </p>
      <p className={`text-sm ${value ? 'text-brand' : 'text-brand-muted'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

// ── Campo en modo edición: input ────────────────────────────
function EditInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="fz-auth-input min-h-[44px]"
      />
    </div>
  )
}

// ── Campo en modo edición: select ───────────────────────────
function EditSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  options: readonly string[]; placeholder: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className={`fz-auth-input min-h-[44px] bg-white ${value ? 'text-brand' : 'text-brand-muted'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────
export default function PerfilPage() {
  const router = useRouter()
  const { profile, loading, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState<Required<ProfileUpdate>>({
    displayName: '', giro: '', ciudad: '', estado: '',
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  async function handleUpgrade() {
    setCheckoutLoading(true)
    await startProCheckout()
    setCheckoutLoading(false)
  }

  function startEditing() {
    setDraft({
      displayName: profile?.displayName ?? '',
      giro:        profile?.giro        ?? '',
      ciudad:      profile?.ciudad      ?? '',
      estado:      profile?.estado      ?? '',
    })
    setEditing(true)
    setSaveError('')
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError('')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      await updateProfile(draft)
      setEditing(false)
    } catch {
      setSaveError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-mid">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4 fz-pad-safe-bottom">

        {/* Datos del negocio */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-border">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Datos del negocio
            </p>
            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button" onClick={cancelEditing}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px] text-brand-mid"
                >
                  Cancelar
                </button>
                <button
                  type="button" onClick={handleSave} disabled={saving}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white min-h-[32px] transition-opacity disabled:opacity-60 bg-brand"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={startEditing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px] text-brand border border-brand-border bg-brand-chip"
              >
                Editar
              </button>
            )}
          </div>

          <div className="px-4 pb-4">
            {editing ? (
              <div className="flex flex-col gap-4 pt-2">
                <EditInput
                  label="Nombre del negocio o tuyo"
                  value={draft.displayName}
                  onChange={v => setDraft(d => ({ ...d, displayName: v }))}
                  placeholder="Ej: Taquería El Güero, Juan García"
                />
                <EditSelect
                  label="Giro / Industria"
                  value={draft.giro}
                  onChange={v => setDraft(d => ({ ...d, giro: v }))}
                  options={GIROS}
                  placeholder="Selecciona tu giro"
                />
                <EditInput
                  label="Ciudad"
                  value={draft.ciudad}
                  onChange={v => setDraft(d => ({ ...d, ciudad: v }))}
                  placeholder="Ej: Guadalajara"
                />
                <EditSelect
                  label="Estado"
                  value={draft.estado}
                  onChange={v => setDraft(d => ({ ...d, estado: v }))}
                  options={ESTADOS_MX}
                  placeholder="Selecciona tu estado"
                />

                {saveError && (
                  <p className="text-sm text-danger">{saveError}</p>
                )}
              </div>
            ) : (
              <div>
                <ReadField label="Nombre del negocio o tuyo" value={profile.displayName} />
                <ReadField label="Giro / Industria" value={profile.giro} />
                <ReadField label="Ciudad" value={profile.ciudad} />
                <div className="flex flex-col gap-1 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                    Estado
                  </p>
                  <p className={`text-sm ${profile.estado ? 'text-brand' : 'text-brand-muted'}`}>
                    {profile.estado || '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cuenta */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-border">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Cuenta
            </p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex flex-col gap-1 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Correo</p>
              <p className="text-sm text-brand">{profile.email}</p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Plan</p>
                  <p className="text-sm font-semibold mt-0.5 text-brand">
                    {profile.plan === 'pro' ? 'Pro ✓' : 'Base'}
                  </p>
                </div>
                {profile.plan === 'free' && (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="text-xs font-bold px-3 py-2 rounded-lg text-white min-h-[36px] flex items-center transition-opacity bg-brand disabled:opacity-60"
                  >
                    {checkoutLoading ? 'Cargando...' : 'Actualizar a Pro'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                  Movimientos registrados
                </p>
                <p className="text-2xl font-bold mt-0.5 text-brand">
                  {profile.totalMovements.toLocaleString('es-MX')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Volver */}
        <button
          type="button" onClick={() => router.back()}
          className="text-sm font-medium py-3 rounded-xl min-h-[44px] transition-colors text-brand-mid bg-paper-soft"
        >
          ← Volver
        </button>

      </main>
    </div>
  )
}
