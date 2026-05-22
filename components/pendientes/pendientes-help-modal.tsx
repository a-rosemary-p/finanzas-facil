'use client'

/**
 * Modal de ayuda del feature de Pendientes / Recurrentes (v0.60).
 *
 * Solo modo manual (botón "?" en /pendientes). NO se dispara automáticamente
 * — pendientes y recurrentes ya están en producción desde hace tiempo y los
 * users actuales ya los conocen. Esto es help repaseable.
 *
 * Mismo estilo visual que ProjectsOnboardingModal: hero con mocks de la app
 * real, texto corto, dots clickeables.
 */

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { IconCalendar } from '@/components/icons'

interface PendientesHelpModalProps {
  onClose: () => void
}

export function PendientesHelpModal({ onClose }: PendientesHelpModalProps) {
  const [step, setStep] = useState(0)

  const isFirst = step === 0
  const isLast = step === 2

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-md w-full overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-brand-mid text-base leading-none w-7 h-7 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center z-10"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div className="bg-brand-chip pt-7 pb-5 px-6 flex flex-col items-center gap-3">
          {step === 0 && <StepPendientes />}
          {step === 1 && <StepRecurrentes />}
          {step === 2 && <StepSecciones />}
        </div>

        <div className="p-5 flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase text-brand-mid tracking-wide">
            Paso {step + 1} de 3
          </span>
          {step === 0 && (
            <>
              <h2 className="font-bold text-base text-brand">
                Compromisos antes de que pasen
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Pendientes son cobros y pagos que aún no se concretan.
                Cuando se hacen reales, los marcas como pagados.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-bold text-base text-brand">
                Recurrentes que se generan solos
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Para movimientos que se repiten (renta, suscripción).
                Al pagar el actual, Fiza crea el siguiente automáticamente.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-bold text-base text-brand">
                Organizado por urgencia
              </h2>
              <p className="text-sm text-brand-mid leading-relaxed">
                Vencidos primero, luego los próximos, recurrentes al final.
                Toca <strong>+</strong> en cualquier sección para agregar manual.
              </p>
            </>
          )}

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

          <div className="flex gap-2 mt-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-brand-mid bg-paper-2"
              >
                Atrás
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white"
              >
                Entendido
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
 * Visuales por paso — mocks de la UI real de /pendientes.
 * ──────────────────────────────────────────────────────────────── */

/** Paso 1: dos cards lado a lado — uno "voy a cobrar" verde, uno "voy a pagar" rojo. */
function StepPendientes() {
  return (
    <div className="w-full flex flex-col gap-2 items-center">
      <IconCalendar size={32} />
      <div className="flex gap-2 w-full max-w-[280px]">
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-brand-border px-2.5 py-2 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase text-brand-mid">Me van a pagar</p>
          <p className="text-xs font-medium text-brand truncate">Cobro cliente</p>
          <p className="font-bold text-xs text-brand">+{formatCurrency(5000)}</p>
        </div>
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-brand-border px-2.5 py-2 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase text-brand-mid">Voy a pagar</p>
          <p className="text-xs font-medium text-brand truncate">Renta marzo</p>
          <p className="font-bold text-xs text-danger">−{formatCurrency(12000)}</p>
        </div>
      </div>
    </div>
  )
}

/** Paso 2: card con loop icon → flecha → siguiente pendiente generado. */
function StepRecurrentes() {
  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Card recurrente */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-border px-3 py-2.5 w-full max-w-[260px] flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-mid shrink-0">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-brand truncate">Renta oficina</p>
          <p className="text-[10px] text-brand-mid">Cada mes · próx. 1 de junio</p>
        </div>
        <span className="font-bold text-xs text-danger whitespace-nowrap">
          −{formatCurrency(12000)}
        </span>
      </div>

      {/* Flecha */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-brand-mid">Al pagar →</span>
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
          <path d="M6 1v11M2 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-mid"/>
        </svg>
      </div>

      {/* Siguiente generado */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-border px-3 py-2 w-full max-w-[260px] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase bg-brand-chip text-brand px-1.5 py-0.5 rounded">Nuevo</span>
        <p className="text-xs font-medium text-brand truncate flex-1">Renta oficina</p>
        <span className="text-[10px] text-brand-mid">1 jul</span>
      </div>
    </div>
  )
}

/** Paso 3: 3 mini section headers como aparecen en /pendientes (colapsibles). */
function StepSecciones() {
  return (
    <div className="w-full flex flex-col gap-1.5 max-w-[280px]">
      {[
        { label: 'Recurrentes', count: 3, tone: 'default' as const, open: false },
        { label: 'Vencidos',    count: 2, tone: 'danger'  as const, open: true  },
        { label: 'Pendientes',  count: 5, tone: 'default' as const, open: true  },
      ].map(s => (
        <div
          key={s.label}
          className={[
            'flex items-center gap-2 px-3 py-2 rounded-lg border',
            s.tone === 'danger'
              ? 'bg-white border-danger/30 text-danger'
              : 'bg-white border-brand-border text-brand',
          ].join(' ')}
        >
          <span className="text-xs font-bold flex-1">{s.label}</span>
          <span className={[
            'text-[10px] font-bold px-1.5 py-0.5 rounded',
            s.tone === 'danger' ? 'bg-danger/10' : 'bg-brand-chip',
          ].join(' ')}>{s.count}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: s.open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <button
            type="button"
            tabIndex={-1}
            className="text-xs font-bold opacity-70 px-1"
            aria-hidden="true"
          >
            +
          </button>
        </div>
      ))}
    </div>
  )
}
