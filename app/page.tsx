'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

/* ─────────────────────────────────────────
   Mock UIs para el carousel (sin imágenes reales)
───────────────────────────────────────── */

function MockInput() {
  return (
    <div aria-hidden="true" className="h-40 rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'var(--brand-chip)' }}>
      <div className="flex-1 rounded-lg p-3" style={{ background: '#fff', border: '1px solid var(--brand-border)' }}>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--brand)' }}>
          Vendí $1,500 de tacos, gasté $300 en tortillas y $120 en gas...
        </p>
        <span className="inline-block w-0.5 h-3 mt-1 align-middle rounded-full" style={{ background: 'var(--brand)', opacity: 0.7 }} />
      </div>
      <div className="flex gap-2 justify-center">
        {['✏️', '🎤', '📷'].map(icon => (
          <span
            key={icon}
            className="text-base rounded-xl px-3 py-1.5"
            style={{ background: '#fff', border: '1px solid var(--brand-border)' }}
          >
            {icon}
          </span>
        ))}
      </div>
    </div>
  )
}

function MockAI() {
  const rows = [
    { badge: 'Ingreso',   badgeBg: 'var(--brand-lime)', badgeColor: 'var(--brand)', text: 'Ventas del día', amount: '+$1,500', amountColor: 'var(--brand)' },
    { badge: 'Gasto',     badgeBg: '#FAD5BF', badgeColor: '#D0481A', text: 'Tortillas',       amount: '−$300',   amountColor: '#D0481A' },
    { badge: 'Pendiente', badgeBg: '#FFF5CC', badgeColor: '#B89010', text: 'Renta (lunes)',   amount: '⏳$400',  amountColor: '#B89010' },
  ]
  return (
    <div aria-hidden="true" className="h-40 rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'var(--brand-chip)' }}>
      {rows.map(r => (
        <div
          key={r.badge}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
          style={{ background: '#fff', border: '1px solid var(--brand-border)' }}
        >
          <span
            className="text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0"
            style={{ background: r.badgeBg, color: r.badgeColor }}
          >
            {r.badge}
          </span>
          <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--brand)' }}>{r.text}</span>
          <span className="text-[11px] font-bold shrink-0" style={{ color: r.amountColor }}>{r.amount}</span>
        </div>
      ))}
    </div>
  )
}

function MockDashboard() {
  const cards = [
    { label: 'INGRESOS', value: '$1,500', bg: 'var(--brand-lime)', color: 'var(--brand)', border: 'var(--brand-light)' },
    { label: 'GASTOS',   value: '$300',   bg: '#FAD5BF', color: '#D0481A', border: '#F79366' },
    { label: 'NETO',     value: '$1,200', bg: 'var(--brand-lime)', color: 'var(--brand)', border: 'var(--brand-light)' },
  ]
  return (
    <div aria-hidden="true" className="h-40 rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'var(--brand-chip)' }}>
      <div className="grid grid-cols-3 gap-1.5">
        {cards.map(c => (
          <div
            key={c.label}
            className="rounded-lg p-2 text-center"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <p className="text-[8px] font-bold leading-none mb-1" style={{ color: c.color }}>{c.label}</p>
            <p className="text-[12px] font-bold leading-none" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-2.5" style={{ background: '#fff', border: '1px solid var(--brand-border)' }}>
        <div className="flex gap-1 mb-1.5 items-center">
          <div className="h-1.5 rounded-full" style={{ flex: 5, background: 'var(--brand)' }} />
          <div className="h-1.5 rounded-full" style={{ flex: 2, background: 'var(--brand-border)' }} />
        </div>
        <p className="text-[9px]" style={{ color: 'var(--brand-mid)' }}>Balance del mes — 71% de meta</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Datos de los pasos
───────────────────────────────────────── */

const STEPS: Array<{
  num: string
  title: string
  body: string
  Visual: React.ComponentType
}> = [
  {
    num: '1',
    title: 'Dile lo que pasó',
    body: 'Escribe, dicta o fotografía. Como quieras, como puedas.',
    Visual: MockInput,
  },
  {
    num: '2',
    title: 'La IA lo organiza',
    body: 'En segundos, cada peso queda clasificado y listo para revisarse.',
    Visual: MockAI,
  },
  {
    num: '3',
    title: 'Ve tus números',
    body: 'Sabes exactamente cuánto entraste, cuánto gastaste y cuánto te quedó.',
    Visual: MockDashboard,
  },
]

const FREE_FEATURES = [
  '10 movimientos al día',
  'Texto, voz y foto',
  'Historial 30 días',
  'Dashboard con métricas',
]

const PRO_FEATURES = [
  'Sin límite de movimientos',
  'Texto, voz y foto',
  'Historial completo',
  'Todos tus dispositivos',
]

/* ─────────────────────────────────────────
   Página
───────────────────────────────────────── */

export default function HomePage() {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const handler = () => {
      const w = el.scrollWidth / STEPS.length
      setActiveStep(Math.min(Math.round(el.scrollLeft / w), STEPS.length - 1))
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fff' }}>

      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-20 bg-white flex items-center justify-between px-4 shrink-0"
        style={{
          borderBottom: '1px solid var(--brand-border)',
          height: '56px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <span className="font-bold text-2xl" style={{ color: 'var(--brand)' }}>
          FinanzasFácil
        </span>
        <Link
          href="/login"
          className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors min-h-[40px] flex items-center"
          style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
        >
          Iniciar sesión
        </Link>
      </header>

      {/* ── Hero ── */}
      <section
        className="flex flex-col items-center text-center px-5 pt-20 pb-16"
        style={{ background: 'linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)' }}
      >
        <h1
          className="font-bold leading-tight mb-5"
          style={{ color: '#fff', fontSize: 'clamp(2rem, 8vw, 2.75rem)', maxWidth: '340px' }}
        >
          Tus cuentas,<br />sin cuentos.
        </h1>

        <p
          className="text-base leading-relaxed mb-10"
          style={{ color: 'rgba(255,255,255,0.88)', maxWidth: '300px' }}
        >
          Escribe, dicta o fotografía lo que pasó en tu negocio.
          FinanzasFácil lo organiza todo automáticamente.
        </p>

        <div className="flex flex-col gap-3 w-full" style={{ maxWidth: '320px' }}>
          <Link
            href="/login?mode=register"
            className="w-full py-4 rounded-xl font-bold text-lg text-center min-h-[56px] flex items-center justify-center gap-2"
            style={{
              background: '#fff',
              color: 'var(--brand)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
            }}
          >
            Empieza gratis <span>→</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-center py-2"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            Ya tengo cuenta — Iniciar sesión
          </Link>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="pt-12 pb-2 bg-white">
        <p
          className="text-xs font-bold text-center mb-7 px-4"
          style={{ color: 'var(--brand-mid)', letterSpacing: '0.12em' }}
        >
          CÓMO FUNCIONA
        </p>

        <div className="md:max-w-4xl md:mx-auto md:px-8">
          <div
            ref={carouselRef}
            role="list"
            aria-label="Cómo funciona FinanzasFácil"
            className="ff-carousel no-scrollbar flex gap-4"
            style={{
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              padding: '4px 24px 20px',
              paddingRight: '52px',
            }}
          >
            {STEPS.map(step => (
              <div
                key={step.num}
                role="listitem"
                className="flex flex-col gap-3 bg-white rounded-2xl p-4 shrink-0"
                style={{
                  width: '240px',
                  scrollSnapAlign: 'start',
                  border: '1px solid var(--brand-border)',
                  boxShadow: '0 2px 12px rgba(87,132,102,0.08)',
                }}
              >
                <step.Visual />
                <div className="flex items-start gap-2.5">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    {step.num}
                  </span>
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--brand)' }}>{step.title}</p>
                    <p className="text-xs italic leading-snug" style={{ color: 'var(--brand-mid)' }}>{step.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots — solo visibles en mobile */}
        <div className="flex md:hidden justify-center gap-2 pb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width:      activeStep === i ? '20px' : '8px',
                height:     '8px',
                background: activeStep === i ? 'var(--brand)' : 'var(--brand-border)',
              }}
            />
          ))}
        </div>
        <div className="hidden md:block pb-10" />
      </section>

      {/* ── Para quién es ── */}
      <section className="px-4 py-12" style={{ background: 'var(--brand-chip)' }}>
        <div className="max-w-lg mx-auto">
          <div
            className="bg-white rounded-2xl p-8"
            style={{ border: '1px solid var(--brand-border)', boxShadow: '0 2px 16px rgba(87,132,102,0.07)' }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--brand)' }}>
              Para negocios como el tuyo
            </h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--brand-mid)' }}>
              Taquerías &nbsp;·&nbsp; Tiendas de abarrotes &nbsp;·&nbsp; Talleres &nbsp;·&nbsp;
              Estéticas &nbsp;·&nbsp; Food trucks &nbsp;·&nbsp; Vendedores de cualquier cosa
            </p>
            <p
              className="text-sm italic leading-relaxed pt-5"
              style={{ color: 'var(--brand)', borderTop: '1px solid var(--brand-border)' }}
            >
              Si llevas tus cuentas en un cuaderno, en tu cabeza, o en el WhatsApp de tu familia
              — FinanzasFácil es para ti.
            </p>
          </div>
        </div>
      </section>

      {/* ── Precios ── */}
      <section className="px-4 py-12 bg-white">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-center mb-7" style={{ color: 'var(--brand)' }}>
            Simple y sin sorpresas
          </h2>

          <div className="grid grid-cols-2 gap-3">

            {/* Free */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: '#fff', border: '1px solid var(--brand-border)' }}
            >
              <div>
                <p className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color: 'var(--brand-muted)' }}>
                  GRATIS
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>$0</p>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="text-xs shrink-0 mt-px font-bold" style={{ color: 'var(--brand)' }}>✓</span>
                    <span className="text-xs leading-snug" style={{ color: 'var(--brand)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=register"
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-center border min-h-[40px] flex items-center justify-center"
                style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
              >
                Empieza gratis
              </Link>
            </div>

            {/* Pro */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: '#EEFBE8', border: '2px solid var(--brand)' }}
            >
              <div className="text-center -mt-1">
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  MÁS POPULAR
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color: 'var(--brand)' }}>
                  PRO
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>
                  $99
                  <span className="text-sm font-normal ml-0.5" style={{ color: 'var(--brand-mid)' }}>/mes</span>
                </p>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="text-xs shrink-0 mt-px font-bold" style={{ color: 'var(--brand)' }}>✓</span>
                    <span className="text-xs leading-snug" style={{ color: 'var(--brand)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=register"
                className="w-full py-2.5 rounded-xl text-sm font-bold text-center text-white min-h-[40px] flex items-center justify-center"
                style={{ background: 'var(--brand)' }}
              >
                Suscribirme
              </Link>
            </div>
          </div>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--brand-muted)' }}>
            Cancela cuando quieras. Sin permanencia.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 text-center mt-auto" style={{ background: 'var(--brand)' }}>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
          FinanzasFácil &nbsp;·&nbsp; © 2026 finanzasfacil.mx
        </p>
      </footer>

    </div>
  )
}
