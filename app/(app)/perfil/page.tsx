'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { GIROS, ESTADOS_MX } from '@/lib/constants'
import type { ProfileUpdate } from '@/types'
import { WaveRule } from '@/components/ui/wave'
import { AppHeader } from '@/components/app-header'
import { startProCheckout } from '@/lib/upgrade-to-pro'

// ── Campo en modo lectura ───────────────────────────────────
function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: value ? 'var(--brand)' : 'var(--brand-muted)' }}>
        {value || '—'}
      </p>
      <WaveRule />
    </div>
  )
}

// ── Campo en modo edición: input ────────────────────────────
function EditInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
        {label}
      </label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 min-h-[44px]"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
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
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
        {label}
      </label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 min-h-[44px] bg-white"
        style={{ borderColor: 'var(--brand-border)', color: value ? 'var(--brand)' : 'var(--brand-muted)' }}
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
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>

      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >

        {/* Datos del negocio */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--brand-border)' }}>
          {/* Card header: label left, edit/save/cancel right */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>
              Datos del negocio
            </p>
            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button" onClick={cancelEditing}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px]"
                  style={{ color: 'var(--brand-mid)' }}
                >
                  Cancelar
                </button>
                <button
                  type="button" onClick={handleSave} disabled={saving}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white min-h-[32px] transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--brand)' }}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={startEditing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[32px]"
                style={{ color: 'var(--brand)', border: '1px solid var(--brand-border)', background: 'var(--brand-chip)' }}
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
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{saveError}</p>
                )}
              </div>
            ) : (
              <div>
                <ReadField label="Nombre del negocio o tuyo" value={profile.displayName} />
                <ReadField label="Giro / Industria" value={profile.giro} />
                <ReadField label="Ciudad" value={profile.ciudad} />
                <div className="flex flex-col gap-1 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                    Estado
                  </p>
                  <p className="text-sm" style={{ color: profile.estado ? 'var(--brand)' : 'var(--brand-muted)' }}>
                    {profile.estado || '—'}
                  </p>
                  <WaveRule />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cuenta */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--brand-border)' }}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>
              Cuenta
            </p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex flex-col gap-1 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Correo</p>
              <p className="text-sm" style={{ color: 'var(--brand)' }}>{profile.email}</p>
              <WaveRule />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Plan</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--brand)' }}>
                    {profile.plan === 'pro' ? 'Pro ✓' : 'Base'}
                  </p>
                </div>
                {profile.plan === 'free' && (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="text-xs font-bold px-3 py-2 rounded-lg text-white min-h-[36px] flex items-center transition-opacity"
                    style={{ background: 'var(--brand)', opacity: checkoutLoading ? 0.6 : 1 }}
                  >
                    {checkoutLoading ? 'Cargando...' : 'Actualizar a Pro'}
                  </button>
                )}
              </div>
              <WaveRule />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                  Movimientos registrados
                </p>
                <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--brand)' }}>
                  {profile.totalMovements.toLocaleString('es-MX')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Volver */}
        <button
          type="button" onClick={() => router.back()}
          className="text-sm font-medium py-3 rounded-xl min-h-[44px] transition-colors"
          style={{ color: 'var(--brand-mid)', background: 'rgba(255,255,255,0.6)' }}
        >
          ← Volver
        </button>

      </main>
    </div>
  )
}
