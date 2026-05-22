'use client'

/**
 * Modal de onboarding del feature de Proyectos (v0.5). 3 pasos educativos.
 *
 * Dos modos:
 *   - Automático (en /inicio): aparece UNA vez para Pros que aún no lo han
 *     visto (`profile.projectsOnboardedAt === null`). Al cerrar setea el flag.
 *   - Manual ("?" en /proyectos): el user lo abre cuando quiere. NO marca
 *     como visto al cerrar (`markSeenOnClose=false`) — es help, no tutorial.
 *
 * No es bloqueante: el user puede cerrar en cualquier paso. El flag se setea
 * tanto si llega al final como si cierra a media.
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { IconFolder } from '@/components/icons'

interface ProjectsOnboardingModalProps {
  /** Si true, al cerrar hace POST /api/onboarding/projects-seen. Default true. */
  markSeenOnClose?: boolean
  onClose: () => void
}

interface Step {
  title: string
  body: React.ReactNode
}

const STEPS: Step[] = [
  {
    title: '¿Qué son los proyectos?',
    body: (
      <>
        <p>
          Agrupa los movimientos de un cliente o trabajo en un proyecto.
          Fiza calcula cuánto <strong>realmente ganaste</strong>: ingresos menos
          gastos por proyecto, no solo en general.
        </p>
        <p className="text-brand-mid">
          Útil si cobras por trabajo terminado y quieres saber qué clientes valen la pena.
        </p>
      </>
    ),
  },
  {
    title: 'La IA los detecta sola',
    body: (
      <>
        <p>
          Cuando registres algo y menciones el cliente o el nombre del proyecto,
          Fiza lo asigna automáticamente.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-brand-mid pl-4 list-disc">
          <li>&ldquo;cobré 5000 de Martínez&rdquo; → si existe proyecto con cliente Martínez, lo asigna</li>
          <li>&ldquo;vendí 2000 del proyecto Reyes&rdquo; → te ofrece crear el proyecto Reyes</li>
        </ul>
        <p className="text-brand-mid">
          Si la IA no está segura, lo eliges manualmente en la pantalla de confirmación.
        </p>
      </>
    ),
  },
  {
    title: 'Archiva al terminar',
    body: (
      <>
        <p>
          Cuando termines un trabajo, archívalo desde el detalle del proyecto. La
          historia financiera se conserva — solo se quita de la vista activa.
        </p>
        <p className="text-brand-mid">
          Puedes tener hasta <strong>10 proyectos activos</strong> a la vez.
          Los archivados no cuentan al tope.
        </p>
      </>
    ),
  },
]

export function ProjectsOnboardingModal({ markSeenOnClose = true, onClose }: ProjectsOnboardingModalProps) {
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]!

  async function handleClose() {
    setClosing(true)
    if (markSeenOnClose) {
      // Fail-soft: si falla, el user verá el modal otra vez la próxima sesión.
      // Mejor a fallar el close.
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
        className="bg-white rounded-2xl max-w-md w-full p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con icono + step indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconFolder size={20} />
            <span className="text-[11px] font-bold uppercase text-brand-mid">
              Proyectos · {step + 1} de {STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-brand-mid text-lg leading-none px-1"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-brand' : 'w-1.5 bg-brand-border',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          <h2 className="font-bold text-base text-brand">{current.title}</h2>
          <div className="text-sm text-brand flex flex-col gap-2 leading-relaxed">
            {current.body}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-1">
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
  )
}
