'use client'

/**
 * Modal de onboarding del feature de Proyectos (v0.5). 3 pasos visuales.
 *
 * Dos modos:
 *   - Automático (en /inicio): aparece UNA vez para Pros que aún no lo han
 *     visto (`profile.projectsOnboardedAt === null`). Al cerrar setea el flag.
 *   - Manual ("?" en /proyectos): el user lo abre cuando quiere. NO marca
 *     como visto al cerrar (`markSeenOnClose=false`) — es help, no tutorial.
 *
 * Diseño: cada paso tiene una "ilustración" CSS arriba (no imagen — todo
 * inline para no agregar assets) + título corto + 1-2 líneas. Pocas
 * palabras, mucho visual.
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { IconFolder } from '@/components/icons'
import { formatCurrency } from '@/lib/utils'

interface ProjectsOnboardingModalProps {
  /** Si true, al cerrar hace POST /api/onboarding/projects-seen. Default true. */
  markSeenOnClose?: boolean
  onClose: () => void
}

export function ProjectsOnboardingModal({ markSeenOnClose = true, onClose }: ProjectsOnboardingModalProps) {
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)

  const isFirst = step === 0
  const isLast = step === 2

  async function handleClose() {
    setClosing(true)
    if (markSeenOnClose) {
      try {
        await fetchWithAuthRetry('/api/onboarding/projects-seen', { method: 'POST' })
      } catch {}
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-md w-full overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button flotante sobre el hero. text-brand-mid + bg semi para
          * que se lea contra el brand-chip del hero sin chocar visualmente. */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-brand-mid text-base leading-none w-7 h-7 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center z-10"
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Hero visual del step */}
        <div className="bg-brand-chip pt-7 pb-5 px-6 flex flex-col items-center gap-3">
          {step === 0 && <StepOneVisual />}
          {step === 1 && <StepTwoVisual />}
          {step === 2 && <StepThreeVisual />}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase text-brand-mid tracking-wide">
            Paso {step + 1} de 3
          </span>
          {step === 0 && (
            <>
              <h2 className="font-bold text-base text-brand">
                Mide cuánto ganaste por cliente
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Un proyecto agrupa ingresos y gastos de un mismo trabajo.
                Fiza te dice el neto real, no solo el de tu negocio en general.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-bold text-base text-brand">
                La IA los asigna sola
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Menciona al cliente o al proyecto cuando registres.
                Si no está seguro, lo eliges en la confirmación.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-bold text-base text-brand">
                Archiva cuando termines
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Hasta <strong>10 activos</strong> a la vez. Al archivar,
                la historia se queda — solo se quita de la vista.
              </p>
            </>
          )}

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-6 bg-brand' : 'w-1.5 bg-brand-border',
                ].join(' ')}
                aria-label={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-2 mt-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                disabled={closing}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-brand-mid bg-paper-2"
              >
                Atrás
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={closing}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                disabled={closing}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white disabled:opacity-50"
              >
                {closing ? 'Guardando…' : 'Entendido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
 * Ilustraciones por paso. Todas CSS+SVG inline, no imágenes externas.
 * Estilo: mock de cards de la app real — el user reconoce los elementos.
 * ──────────────────────────────────────────────────────────────── */

/** Paso 1: card de proyecto estilo lista, con métricas verde/rojo. */
function StepOneVisual() {
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <IconFolder size={32} />
      <div className="bg-white rounded-xl shadow-sm border border-brand-border px-3 py-2.5 w-full max-w-[260px] flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-brand truncate">Casa Pedro</p>
            <p className="text-[10px] text-brand-mid truncate">Pedro Reyes</p>
          </div>
          <span className="font-bold text-xs text-brand whitespace-nowrap">
            +{formatCurrency(12500)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-brand-mid">
          <span>+{formatCurrency(35000)}</span>
          <span>−{formatCurrency(22500)}</span>
          <span className="ml-auto">8 movs</span>
        </div>
      </div>
    </div>
  )
}

/** Paso 2: "chat bubble" del user → flecha → card de mov con proyecto asignado. */
function StepTwoVisual() {
  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      {/* Bubble del user */}
      <div className="self-stretch flex justify-start">
        <div className="bg-white rounded-2xl rounded-bl-sm border border-brand-border px-3 py-2 max-w-[80%]">
          <p className="text-xs text-brand italic">
            &ldquo;cobré 5000 de Martínez&rdquo;
          </p>
        </div>
      </div>

      {/* Flecha hacia abajo con sparkle "IA" */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-brand-mid uppercase tracking-wider">IA</span>
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
          <path d="M6 1v11M2 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-mid"/>
        </svg>
      </div>

      {/* Card con proyecto asignado */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-border px-3 py-2 w-full max-w-[260px] flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-brand truncate">Cobro Martínez</p>
          <div className="flex items-center gap-1 mt-0.5">
            <IconFolder size={10} />
            <p className="text-[10px] text-brand-mid truncate">Casa Martínez</p>
          </div>
        </div>
        <span className="font-bold text-xs text-brand whitespace-nowrap">
          +{formatCurrency(5000)}
        </span>
      </div>
    </div>
  )
}

/** Paso 3: card normal → tachado/archivado con badge "Archivado". */
function StepThreeVisual() {
  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Card archivada */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-border px-3 py-2.5 w-full max-w-[260px] flex flex-col gap-1 opacity-70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <p className="font-bold text-xs text-brand-mid truncate">Casa Pedro</p>
            <span className="text-[9px] font-bold uppercase bg-paper-2 text-brand-mid px-1 py-0.5 rounded">
              Archivado
            </span>
          </div>
          <span className="font-bold text-xs text-brand-mid whitespace-nowrap">
            +{formatCurrency(12500)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-brand-mid">
          <span>8 movs · terminado</span>
        </div>
      </div>

      {/* Badge contador "X / 10 activos" */}
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[10px] text-brand-mid">Activos:</span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={[
                'w-1.5 h-1.5 rounded-full',
                i < 6 ? 'bg-brand' : 'bg-brand-border',
              ].join(' ')}
            />
          ))}
        </div>
        <span className="text-[10px] font-bold text-brand-mid">6/10</span>
      </div>
    </div>
  )
}
