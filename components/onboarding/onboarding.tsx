'use client'

/**
 * Onboarding inline para `/registros` — primera vez del usuario.
 *
 * Trigger: `profile.totalMovements === 0 && !profile.onboardedAt`. La página
 * principal queda visible atrás (con backdrop tenue); el tour highlightea los
 * 3 modos de captura uno por uno, ejecuta una demo animada del micrófono
 * (sin tocar OpenAI — todo es scripted), abre una confirmación guiada con
 * datos demo, y al cerrar marca `profiles.onboarded_at = NOW()` para no
 * volver a aparecer aunque el user borre todos sus movimientos.
 *
 * Componente self-contained — toma `highlight` para que el `InputCard` real
 * pueda aplicar el halo (z-index + glow) en el botón correcto vía prop.
 *
 * Steps:
 *   welcome → highlight-foto → highlight-dictar → highlight-escribir
 *   → mic-demo → confirm-demo → done
 *
 * En cualquier step el user puede saltar (botón discreto). Skip == complete:
 * marca onboarded_at y se va. La spec del user aceptó esto.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import {
  IconCamera, IconMicrophone, IconPencil, IconArrowRight, IconChatText,
} from '@/components/icons'

export type OnboardingHighlight = 'foto' | 'dictar' | 'escribir' | null

interface Props {
  /** Llamado cuando termina o salta. Padre debe ocultar el componente y
   *  refrescar el profile para que useAuth no vuelva a triggerlo. */
  onComplete: () => void
  /** Callback con el target a resaltar (o null) para que el InputCard
   *  aplique el halo en el botón correcto. */
  onHighlightChange: (target: OnboardingHighlight) => void
  /** Nombre del user para el welcome. */
  displayName: string
}

type Step =
  | 'welcome'
  | 'highlight-foto'
  | 'highlight-dictar'
  | 'highlight-escribir'
  | 'mic-demo'
  | 'confirm-demo'
  | 'done'

const STEP_ORDER: Step[] = [
  'welcome',
  'highlight-foto',
  'highlight-dictar',
  'highlight-escribir',
  'mic-demo',
  'confirm-demo',
  'done',
]

export function Onboarding({ onComplete, onHighlightChange, displayName }: Props) {
  const [step, setStep] = useState<Step>('welcome')

  // Cuando cambia el step, le avisamos al InputCard cuál botón resaltar.
  useEffect(() => {
    const map: Record<Step, OnboardingHighlight> = {
      'welcome':            null,
      'highlight-foto':     'foto',
      'highlight-dictar':   'dictar',
      'highlight-escribir': 'escribir',
      'mic-demo':           'dictar',
      'confirm-demo':       null,
      'done':               null,
    }
    onHighlightChange(map[step])
  }, [step, onHighlightChange])

  // Limpia el highlight al desmontar.
  useEffect(() => {
    return () => onHighlightChange(null)
  }, [onHighlightChange])

  function next() {
    const idx = STEP_ORDER.indexOf(step)
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
  }

  async function finish() {
    onHighlightChange(null)
    try {
      await fetchWithAuthRetry('/api/onboarding/complete', { method: 'POST' })
    } catch {
      // Fail-soft: si el POST truena, igual cerramos. Peor caso, le sale el
      // tour de nuevo en próximo load — molesto pero no roto.
    }
    onComplete()
  }

  return (
    <>
      {/* Backdrop tenue cubriendo todo el viewport. Pointer-events bloquean
       * la interacción con la página real durante el tour. */}
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

      {/* Skip button — siempre visible, esquina superior derecha */}
      <button
        type="button"
        onClick={finish}
        className="text-xs font-medium px-3 py-2 rounded-lg transition-opacity"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          right: 16,
          zIndex: 200,
          background: 'rgba(255, 255, 255, 0.95)',
          color: 'var(--brand-mid)',
          border: '1px solid var(--brand-border)',
          minHeight: 36,
        }}
      >
        Saltar
      </button>

      {/* CSS de halo que el InputCard aplica al botón targeted */}
      <style>{`
        @keyframes fz-halo-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(218, 230, 143, 0.6), 0 0 24px 8px rgba(218, 230, 143, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(218, 230, 143, 0.4), 0 0 32px 12px rgba(218, 230, 143, 0.2); }
        }
        .fz-onboarding-halo {
          position: relative;
          z-index: 150 !important;
          animation: fz-halo-pulse 1.6s ease-in-out infinite;
        }
      `}</style>

      {/* Contenido del step */}
      {step === 'welcome' && (
        <CenterCard>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}>
            Bienvenido
          </p>
          <h2 className="font-bold mb-3" style={{ color: 'var(--brand)', fontSize: 22, lineHeight: 1.2 }}>
            Hola, {displayName}.
            <br />
            Vamos a registrar tu primer movimiento.
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Te muestro los 3 modos de captura en 30 segundos.
          </p>
          <PrimaryButton onClick={next}>
            Empecemos
            <IconArrowRight size={18} />
          </PrimaryButton>
        </CenterCard>
      )}

      {step === 'highlight-foto' && (
        <BottomCard>
          <ModeHeader icon={<IconCamera size={20} />} title="Foto" />
          <p className="text-sm" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Toma una foto de un ticket o factura, o escoge una de tu galería. La IA lee el monto, la fecha y la categoría sola.
          </p>
          <StepNav onNext={next} step={1} of={3} />
        </BottomCard>
      )}

      {step === 'highlight-dictar' && (
        <BottomCard>
          <ModeHeader icon={<IconMicrophone size={20} />} title="Dictar" />
          <p className="text-sm" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Cuéntale a Fiza qué pasó en tu negocio — lo transcribe y organiza por ti.
          </p>
          <StepNav onNext={next} step={2} of={3} />
        </BottomCard>
      )}

      {step === 'highlight-escribir' && (
        <BottomCard>
          <ModeHeader icon={<IconPencil size={20} />} title="Escribir" />
          <p className="text-sm" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Si prefieres tipear, escribe libremente. Puedes registrar movimientos de fechas pasadas también.
          </p>
          <StepNav onNext={next} step={3} of={3} nextLabel="Ver ejemplo" />
        </BottomCard>
      )}

      {step === 'mic-demo' && (
        <MicDemo onComplete={next} />
      )}

      {step === 'confirm-demo' && (
        <ConfirmDemo onComplete={next} />
      )}

      {step === 'done' && (
        <CenterCard>
          <div
            className="rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 56, height: 56, background: 'var(--income-bg)', color: 'var(--income-text)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h2 className="font-bold text-center mb-2" style={{ color: 'var(--brand)', fontSize: 20 }}>
            ¡Así de fácil!
          </h2>
          <p className="text-sm text-center mb-5" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Ahora hazlo tú. Cuéntale a Fiza qué pasó en tu negocio hoy.
          </p>
          <PrimaryButton onClick={finish}>
            Empezar
            <IconArrowRight size={18} />
          </PrimaryButton>
        </CenterCard>
      )}
    </>
  )
}

/* ── Shared UI primitives ─────────────────────────────────────────────────── */

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 200,
        width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--paper)',
        borderRadius: 22,
        boxShadow: 'var(--sh-3)',
        padding: '24px 22px',
      }}
    >
      {children}
    </div>
  )
}

function BottomCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        width: 'min(440px, calc(100vw - 24px))',
        background: 'var(--paper)',
        borderRadius: 18,
        boxShadow: 'var(--sh-3)',
        padding: '18px 20px',
      }}
    >
      {children}
    </div>
  )
}

function ModeHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <div
        className="rounded-lg flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--brand-muted)', color: '#fff' }}
      >
        {icon}
      </div>
      <h3 className="font-bold" style={{ color: 'var(--brand)', fontSize: 17 }}>{title}</h3>
    </div>
  )
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2"
      style={{ background: 'var(--brand)', minHeight: 48 }}
    >
      {children}
    </button>
  )
}

function StepNav({
  onNext, step, of, nextLabel = 'Siguiente',
}: {
  onNext: () => void; step: number; of: number; nextLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex gap-1">
        {Array.from({ length: of }, (_, i) => (
          <span
            key={i}
            style={{
              width: i === step - 1 ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i < step ? 'var(--brand)' : 'var(--brand-border)',
              transition: 'width 0.2s',
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="text-sm font-bold flex items-center gap-1.5 rounded-lg px-3.5"
        style={{ background: 'var(--brand)', color: '#fff', minHeight: 40 }}
      >
        {nextLabel}
        <IconArrowRight size={16} />
      </button>
    </div>
  )
}

/* ── MicDemo ──────────────────────────────────────────────────────────────── */
//
// Burbuja de chat estilo iMessage con el texto apareciendo letra por letra
// + indicador de mic activo. Pure visual, no toca /api/transcribe. Después
// de ~3.5s avanza solo (o el user da Continuar).

const DEMO_TEXT = 'Cobré $5,000 del cliente nuevo, gasté $800 en el hosting del mes.'

function MicDemo({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'recording' | 'typing' | 'done'>('recording')
  const [typedChars, setTypedChars] = useState(0)
  const intervalRef = useRef<number | null>(null)

  // Phase 'recording': 1.2s de waveform animado.
  useEffect(() => {
    if (phase !== 'recording') return
    const t = window.setTimeout(() => setPhase('typing'), 1200)
    return () => window.clearTimeout(t)
  }, [phase])

  // Phase 'typing': aparecen letras una a una (~25ms por char).
  useEffect(() => {
    if (phase !== 'typing') return
    intervalRef.current = window.setInterval(() => {
      setTypedChars(c => {
        if (c >= DEMO_TEXT.length) {
          if (intervalRef.current) window.clearInterval(intervalRef.current)
          window.setTimeout(() => setPhase('done'), 600)
          return c
        }
        return c + 1
      })
    }, 28)
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current) }
  }, [phase])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        width: 'min(440px, calc(100vw - 24px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Burbuja chat */}
      <div
        style={{
          alignSelf: 'flex-start',
          maxWidth: '85%',
          background: 'var(--paper)',
          borderRadius: '18px 18px 18px 4px',
          padding: '12px 14px',
          boxShadow: 'var(--sh-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 56,
        }}
      >
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase" style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}>
          <IconChatText size={12} />
          Tú dictando
        </div>
        {phase === 'recording' ? (
          <Waveform />
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-900)', lineHeight: 1.45 }}>
            {DEMO_TEXT.slice(0, typedChars)}
            {phase === 'typing' && <span className="inline-block w-[1px] h-[1em] align-middle ml-0.5" style={{ background: 'var(--brand)', animation: 'fz-cursor 0.9s steps(1) infinite' }} />}
          </p>
        )}
      </div>

      <BottomCard>
        <div className="text-xs font-medium" style={{ color: 'var(--brand-mid)' }}>
          {phase === 'recording'
            ? 'Grabando lo que dijiste...'
            : phase === 'typing'
            ? 'La IA transcribe el audio.'
            : 'Listo. Ahora la IA va a organizar lo que dijiste en movimientos.'}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            disabled={phase !== 'done'}
            className="text-sm font-bold flex items-center gap-1.5 rounded-lg px-3.5 transition-opacity disabled:opacity-40"
            style={{ background: 'var(--brand)', color: '#fff', minHeight: 40 }}
          >
            Ver lo que entendió
            <IconArrowRight size={16} />
          </button>
        </div>
      </BottomCard>

      <style>{`
        @keyframes fz-cursor { 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}

function Waveform() {
  return (
    <div className="flex items-center gap-1" style={{ height: 24 }}>
      {[0.4, 0.8, 0.6, 1.0, 0.5, 0.7, 0.4, 0.9, 0.6, 0.5, 0.8].map((h, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 3,
            height: `${h * 100}%`,
            background: 'var(--brand-mid)',
            borderRadius: 2,
            animation: `fz-bar ${0.6 + (i % 3) * 0.15}s ease-in-out ${i * 0.05}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes fz-bar { from { transform: scaleY(0.4) } to { transform: scaleY(1) } }
      `}</style>
    </div>
  )
}

/* ── ConfirmDemo ──────────────────────────────────────────────────────────── */
//
// Mini "confirmation screen" estática con los 2 movs detectados desde el
// dictado del paso anterior. NO llama /api/entry/confirm — al dar el botón
// final, simplemente avanza al step 'done'. La idea es que el user vea el
// shape de la pantalla de confirmación real, no que ejecute un INSERT.

const DEMO_MOVEMENTS = [
  { type: 'ingreso' as const, amount: 5000, description: 'Cliente nuevo',     category: 'Honorarios' },
  { type: 'gasto'   as const, amount: 800,  description: 'Hosting mensual',   category: 'Software y suscripciones' },
]

function ConfirmDemo({ onComplete }: { onComplete: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 200,
        width: 'min(440px, calc(100vw - 24px))',
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'auto',
        background: 'var(--paper)',
        borderRadius: 22,
        boxShadow: 'var(--sh-3)',
        padding: '20px 18px',
      }}
    >
      <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--brand-mid)', letterSpacing: '0.1em' }}>
        Paso 4 de 4
      </p>
      <h3 className="font-bold mb-2" style={{ color: 'var(--brand)', fontSize: 18 }}>
        Esto entendió Fiza
      </h3>
      <p className="text-xs mb-3" style={{ color: 'var(--ink-500)', lineHeight: 1.4 }}>
        Verifica los datos antes de guardar. Aquí puedes editar tipo, monto, descripción, categoría y fecha si la IA se equivocó en algo.
      </p>

      <div className="flex flex-col gap-2">
        {DEMO_MOVEMENTS.map((m, i) => (
          <DemoMovementCard key={i} movement={m} index={i} />
        ))}
      </div>

      <div className="rounded-xl px-3 py-2.5 mt-3" style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
        <div className="flex justify-between text-xs" style={{ color: 'var(--ink-700)' }}>
          <span>Ingresos: <strong style={{ color: 'var(--income-text)' }}>+$5,000</strong></span>
          <span>Gastos: <strong style={{ color: 'var(--expense-text)' }}>−$800</strong></span>
          <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Neto: +$4,200</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="w-full rounded-xl text-white text-sm font-bold mt-4 flex items-center justify-center gap-2"
        style={{ background: 'var(--brand)', minHeight: 48 }}
      >
        Confirmar (ejemplo)
        <IconArrowRight size={18} />
      </button>
      <p className="text-[11px] text-center mt-2" style={{ color: 'var(--ink-500)' }}>
        Esto es solo demo — no se va a guardar nada.
      </p>
    </div>
  )
}

function DemoMovementCard({
  movement, index,
}: {
  movement: typeof DEMO_MOVEMENTS[number]
  index: number
}) {
  const isIngreso = movement.type === 'ingreso'
  const cfg = isIngreso
    ? { bg: 'var(--income-bg)', text: 'var(--income-text)', border: 'var(--income-border)', label: 'Ingreso', sign: '+' }
    : { bg: 'var(--expense-bg)', text: 'var(--expense-text)', border: 'var(--expense-border)', label: 'Gasto', sign: '−' }

  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{ background: 'white', border: '1px solid var(--brand-border)', boxShadow: 'var(--sh-1)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[9px] font-bold uppercase rounded-md"
          style={{
            letterSpacing: '0.1em',
            padding: '3px 7px',
            background: cfg.bg,
            color: cfg.text,
            border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>
        <span className="text-[11px] font-medium" style={{ color: 'var(--brand-muted)' }}>
          Movimiento {index + 1}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <Field label="Descripción" value={movement.description} />
        <Field
          label="Monto"
          value={`${cfg.sign}${formatCurrency(movement.amount)}`}
          valueColor={cfg.text}
        />
        <Field label="Categoría" value={movement.category} />
        <Field label="Fecha" value="Hoy" />
      </div>
    </div>
  )
}

function Field({
  label, value, valueColor = 'var(--ink-900)',
}: {
  label: string; value: string; valueColor?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--brand-muted)', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  )
}
