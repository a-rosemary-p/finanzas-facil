'use client'

/**
 * ProfilePromptModal — modal que aparece UNA vez después de que el user
 * confirma su primer movimiento (v0.292). Pide ciudad / estado / giro
 * como datos opcionales — todos los campos pueden quedar vacíos.
 *
 * Flujo:
 *  1. Step `form`: 3 campos (ciudad, estado, giro). Botones "Continuar"
 *     (primario) y "Ahora no" (secundario).
 *  2. Si el user eligió un giro al darle Continuar → step `categories`
 *     que muestra las categorías personalizadas en dos columnas (ingresos /
 *     gastos). Botones "Estas son mis categorías, continuar" (primario,
 *     persiste) y "Regresar" (vuelve al form).
 *  3. Si NO eligió giro → POST directo y cierra.
 *
 * Trigger: `profile.totalMovements >= 1 && !profile.profilePromptSeenAt`.
 * Persistencia: POST /api/onboarding/profile-prompt setea
 * `profile_prompt_seen_at` independientemente de si llenó algo o no.
 *
 * "Ahora no" tiene exactamente el mismo efecto en DB que "Continuar" sin
 * datos: marca seen_at y cierra. La diferencia solo está en el evento de
 * analytics (reason: 'submitted' vs 'dismissed').
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { GIROS, ESTADOS_MX, GIRO_CATEGORIES } from '@/lib/constants'
import { IconArrowRight } from '@/components/icons'

interface Props {
  /** Llamado tras éxito (cualquier branch) — el padre debe ocultar el modal
   *  y refrescar el profile para que `profilePromptSeenAt` quede truthy. */
  onComplete: () => void
}

type Step = 'form' | 'categories'

export function ProfilePromptModal({ onComplete }: Props) {
  const [step, setStep]         = useState<Step>('form')
  const [ciudad, setCiudad]     = useState('')
  const [estado, setEstado]     = useState('')
  const [giro,   setGiro]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function persistAndClose(reason: 'submitted' | 'dismissed') {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetchWithAuthRetry('/api/onboarding/profile-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciudad: ciudad.trim() || undefined,
          estado: estado || undefined,
          giro:   giro   || undefined,
          reason,
        }),
      })
    } catch {
      // Fail-soft: si truena, igual cerramos. El peor caso es que vuelva a
      // aparecer en el próximo load (el seen_at no quedó seteado).
    }
    onComplete()
  }

  // Click en "Continuar" del form: si eligió giro válido, pasa al step de
  // confirmación de categorías. Si no, persiste directo y cierra.
  function handleFormContinue() {
    if (giro && GIRO_CATEGORIES[giro]) {
      setStep('categories')
      return
    }
    void persistAndClose('submitted')
  }

  const giroData = giro && GIRO_CATEGORIES[giro] ? GIRO_CATEGORIES[giro] : null

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14, 23, 17, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 100,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-prompt-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'auto',
          background: 'var(--paper)',
          borderRadius: 22,
          boxShadow: 'var(--sh-3)',
          padding: '24px 22px',
        }}
      >
        {step === 'form' ? (
          <>
            <p
              className="text-xs font-bold uppercase mb-2"
              style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
            >
              Un último paso
            </p>
            <h2
              id="profile-prompt-title"
              className="font-bold mb-2"
              style={{ color: 'var(--brand)', fontSize: 20, lineHeight: 1.25 }}
            >
              Cuéntanos un poco sobre tu negocio
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
              Estos datos nos ayudan a darte mejores reportes y análisis.
              Todos los campos son opcionales.
            </p>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="fz-input-label">Ciudad</span>
                <input
                  type="text"
                  value={ciudad}
                  onChange={e => setCiudad(e.target.value)}
                  placeholder="Ej: Guadalajara"
                  maxLength={80}
                  className="fz-input"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="fz-input-label">Estado</span>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  className="fz-input"
                >
                  <option value="">Selecciona...</option>
                  {ESTADOS_MX.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="fz-input-label">Giro o industria</span>
                <select
                  value={giro}
                  onChange={e => setGiro(e.target.value)}
                  className="fz-input"
                >
                  <option value="">Selecciona...</option>
                  {GIROS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleFormContinue}
              disabled={submitting}
              className="w-full rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 mt-5 disabled:opacity-70"
              style={{ background: 'var(--brand)', minHeight: 48 }}
            >
              {submitting ? 'Guardando…' : (<>Continuar <IconArrowRight size={18} /></>)}
            </button>

            <button
              type="button"
              onClick={() => persistAndClose('dismissed')}
              disabled={submitting}
              className="w-full text-xs font-medium mt-2 py-2 rounded-lg disabled:opacity-70"
              style={{ color: 'var(--brand-mid)', background: 'transparent' }}
            >
              Ahora no
            </button>
          </>
        ) : (
          /* step === 'categories' — confirmación con las cats del giro */
          <>
            <p
              className="text-xs font-bold uppercase mb-2"
              style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}
            >
              {giro}
            </p>
            <h2
              className="font-bold mb-2"
              style={{ color: 'var(--brand)', fontSize: 20, lineHeight: 1.25 }}
            >
              Estas son tus categorías
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
              Fiza usará estas categorías para clasificar tus movimientos
              automáticamente. Más adelante puedes cambiar tu giro desde Ajustes.
            </p>

            {giroData && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'var(--income-bg)',
                    border: '1px solid var(--income-border)',
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase mb-2"
                    style={{ color: 'var(--income-text)', letterSpacing: '0.1em' }}
                  >
                    Ingresos
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {giroData.ingresos.map(c => (
                      <li
                        key={c}
                        className="text-xs leading-snug"
                        style={{ color: 'var(--ink-900)' }}
                      >
                        · {c}
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'var(--expense-bg)',
                    border: '1px solid var(--expense-border)',
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase mb-2"
                    style={{ color: 'var(--expense-text)', letterSpacing: '0.1em' }}
                  >
                    Gastos
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {giroData.gastos.map(c => (
                      <li
                        key={c}
                        className="text-xs leading-snug"
                        style={{ color: 'var(--ink-900)' }}
                      >
                        · {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => persistAndClose('submitted')}
              disabled={submitting}
              className="w-full rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: 'var(--brand)', minHeight: 48 }}
            >
              {submitting ? 'Guardando…' : 'Estas son mis categorías, continuar'}
            </button>

            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={submitting}
              className="w-full text-xs font-medium mt-2 py-2 rounded-lg disabled:opacity-70"
              style={{ color: 'var(--brand-mid)', background: 'transparent' }}
            >
              Regresar
            </button>
          </>
        )}
      </div>
    </>
  )
}
