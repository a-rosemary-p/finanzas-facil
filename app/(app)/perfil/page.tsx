'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { GIROS, ESTADOS_MX, GIRO_DEFAULTS } from '@/lib/constants'
import type { ProfileUpdate } from '@/types'
import { AppHeader } from '@/components/app-header'
import { WaveSection } from '@/components/ui/wave'
import { FeedbackModal } from '@/components/feedback-modal'
import { GiroCategoriesConfirmModal } from '@/components/onboarding/giro-categories-confirm-modal'
import { startProCheckout } from '@/lib/upgrade-to-pro'

// Helpers de UI
//
// Decisión v0.3: read y edit modes deben tener la MISMA altura visual por
// campo para que tocar "Editar" no expanda el card abruptamente. Antes el
// read field era solo texto chico (~32px) y el edit field tenía label +
// input min-h-44px (~70px). Ahora ambos comparten la misma envoltura
// (label arriba + valor en una "fila" min-h-[44px]); en read el valor es
// texto plano dentro de un div del mismo size que un input.

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <FieldShell label={label}>
      <div
        className={[
          'min-h-[44px] flex items-center text-sm',
          value ? 'text-brand' : 'text-brand-muted',
        ].join(' ')}
      >
        {value || '—'}
      </div>
    </FieldShell>
  )
}

function EditInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <FieldShell label={label}>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="fz-auth-input min-h-[44px]"
      />
    </FieldShell>
  )
}

function EditSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  options: readonly string[]; placeholder: string
}) {
  return (
    <FieldShell label={label}>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className={`fz-auth-input min-h-[44px] bg-white ${value ? 'text-brand' : 'text-brand-muted'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </FieldShell>
  )
}

// ── Página ──────────────────────────────────────────────────
export default function PerfilPage() {
  const { profile, loading, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState<Required<ProfileUpdate>>({
    displayName: '', giro: '', ciudad: '', estado: '',
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Confirmación de cambio de giro (v0.3, actualizado v0.32):
  //   Cuando el user cambia su giro a uno mapeado en GIRO_DEFAULTS, antes
  //   de persistir mostramos las nuevas categorías (flat list) y le pedimos
  //   confirmar. `pendingGiroChange` guarda el draft completo a aplicar;
  //   `null` = no hay confirmación pendiente.
  const [pendingGiroChange, setPendingGiroChange] = useState<Required<ProfileUpdate> | null>(null)

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

  async function persistDraft(d: Required<ProfileUpdate>) {
    setSaving(true)
    setSaveError('')
    try {
      await updateProfile(d)
      setEditing(false)
      setPendingGiroChange(null)
    } catch {
      setSaveError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    // Si el user cambió el giro a uno con categorías mapeadas que es distinto
    // del giro actual, abrimos el modal de confirmación. Cualquier otro caso
    // (sin cambio de giro, o cambio a giro no mapeado / vacío) persiste directo.
    const giroChanged = draft.giro !== (profile?.giro ?? '')
    const giroIsMapped = !!draft.giro && !!GIRO_DEFAULTS[draft.giro]
    if (giroChanged && giroIsMapped) {
      setPendingGiroChange(draft)
      return
    }
    void persistDraft(draft)
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

        {/* Título + subtítulo + wave divider — mismo patrón que /pendientes /ajustes. */}
        <div>
          <h1 className="font-bold text-lg text-brand">Perfil</h1>
          <p className="text-sm mt-0.5 text-brand-mid">
            Tu negocio y tu plan.
          </p>
          <div className="mt-3">
            <WaveSection />
          </div>
        </div>

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
            <div className="flex flex-col gap-3 pt-2">
              {editing ? (
                <>
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
                </>
              ) : (
                <>
                  <ReadField label="Nombre del negocio o tuyo" value={profile.displayName} />
                  <ReadField label="Giro / Industria" value={profile.giro} />
                  <ReadField label="Ciudad" value={profile.ciudad} />
                  <ReadField label="Estado" value={profile.estado} />
                </>
              )}
            </div>
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

        {/* Comentarios — abre FeedbackModal. Mismo patrón que /inicio /ajustes. */}
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

      {/* Modal de confirmación de categorías cuando el user cambia el giro
       *  a uno mapeado en GIRO_DEFAULTS. Si confirma, persistimos el draft;
       *  si cancela, dejamos el draft tal cual para que pueda ajustar y volver
       *  a darle Guardar. */}
      {pendingGiroChange && (
        <GiroCategoriesConfirmModal
          giro={pendingGiroChange.giro}
          submitting={saving}
          onConfirm={() => void persistDraft(pendingGiroChange)}
          onCancel={() => setPendingGiroChange(null)}
        />
      )}
    </div>
  )
}
