'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { WaveDivider, WaveUnderline } from '@/components/ui/wave'

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */

function IconPen({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M14.5 2.5l3 3L6.5 16.5l-4 1 1-4L14.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconMic({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="2" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 10a6 6 0 0012 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconCamera({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M18 14.5a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h1.5L7 4h6l1.5 2H16a2 2 0 012 2v6.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="10" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconSparkles({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-3.9L4 8.5l4.4-1.6L10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="12" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="8" y="7" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="14" y="3" width="4" height="15" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconFileText({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 3a1 1 0 011-1h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 2v4h4M7 10h6M7 13h6M7 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconClock({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconHistory({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 10a7.5 7.5 0 107.5-7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2.5 4.5v5.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 7v3l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconShield({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L3 5v4.5c0 4 2.9 7.7 7 9 4.1-1.3 7-5 7-9V5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"
      className="shrink-0"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--dur-std) var(--ease-standard)' }}
    >
      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconFacebook({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function IconInstagram({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

/* ── Business icons ───────────────────────────────────────────────────────── */

function IconUtensils({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2M7 2v20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M21 15V2a5 5 0 00-5 5v5.5M19.5 12.5V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconScissors({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconWrench({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconStore({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9l1-6h16l1 6M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 21V9M19 21V9M9 21v-6h6v6M3 21h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTruck({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 3h15v13H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M16 8h4l3 4v4h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconBriefcase({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M2 12h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

/* ─── Step Card ───────────────────────────────────────────────────────────── */

function StepCard({
  num,
  title,
  body,
  icon: Icon,
  isPro,
}: {
  num: string
  title: string
  body: string
  icon: React.ComponentType<{ size?: number }>
  isPro?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: isPro
          ? 'linear-gradient(145deg, var(--brand) 0%, #3d6050 100%)'
          : 'var(--paper)',
        border: isPro ? 'none' : '1px solid var(--brand-border)',
        boxShadow: isPro ? 'var(--sh-3)' : 'var(--sh-1)',
      }}
    >
      {isPro && (
        <span
          className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', letterSpacing: '0.08em' }}
        >
          PRO
        </span>
      )}

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: isPro ? 'rgba(255,255,255,0.15)' : 'var(--brand-chip)',
          color: isPro ? '#fff' : 'var(--brand)',
        }}
      >
        <Icon size={20} />
      </div>

      <div className="flex items-start gap-2.5">
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: isPro ? 'rgba(255,255,255,0.18)' : 'var(--brand)',
            color: '#fff',
          }}
        >
          {num}
        </span>
        <div>
          <p
            className="text-sm font-bold mb-1"
            style={{ color: isPro ? '#fff' : 'var(--ink-900)', letterSpacing: '-0.01em' }}
          >
            {title}
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: isPro ? 'rgba(255,255,255,0.78)' : 'var(--ink-500)' }}
          >
            {body}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── FAQ Item ────────────────────────────────────────────────────────────── */

function FAQItem({
  q, a, isOpen, onToggle,
}: {
  q: string
  a: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left rounded-xl px-5 py-4 flex gap-3"
      style={{
        background: isOpen ? 'var(--paper)' : 'transparent',
        border: `1px solid ${isOpen ? 'var(--brand-light)' : 'var(--brand-border)'}`,
        boxShadow: isOpen ? 'var(--sh-1)' : 'none',
        transition: `border-color var(--dur-fast) var(--ease-standard),
                     background var(--dur-fast) var(--ease-standard),
                     box-shadow var(--dur-fast) var(--ease-standard)`,
      }}
    >
      <div className="flex-1">
        <p
          className="text-sm font-semibold text-left"
          style={{ color: 'var(--ink-900)', letterSpacing: '-0.01em' }}
        >
          {q}
        </p>
        {isOpen && (
          <p
            className="text-sm leading-relaxed mt-2.5 text-left"
            style={{ color: 'var(--ink-500)', lineHeight: 1.55 }}
          >
            {a}
          </p>
        )}
      </div>
      <span style={{ color: 'var(--ink-300)', marginTop: '1px' }}>
        <IconChevronDown open={isOpen} />
      </span>
    </button>
  )
}

/* ─── Data ────────────────────────────────────────────────────────────────── */

const STEPS: Array<{
  num: string
  title: string
  body: string
  Icon: React.ComponentType<{ size?: number }>
  isPro?: boolean
}> = [
  {
    num: '1',
    title: 'Dile lo que pasó',
    body: 'Escribe en lenguaje natural, dicta en voz o fotografía un recibo. Sin formularios, sin categorías manuales.',
    Icon: IconPen,
  },
  {
    num: '2',
    title: 'La IA lo clasifica sola',
    body: 'Fiza entiende tu texto y lo convierte en ingresos, gastos y pendientes en segundos — sin que hagas nada más.',
    Icon: IconSparkles,
  },
  {
    num: '3',
    title: 'Ve tus números en tiempo real',
    body: 'El dashboard se actualiza al instante. Ingresos, gastos y neto del día — siempre a la vista.',
    Icon: IconChart,
  },
  {
    num: '4',
    title: 'Reportes y pendientes automáticos',
    body: 'Genera tu estado de resultados en PDF con un tap. Ve de un vistazo los compromisos que se vencen.',
    Icon: IconFileText,
    isPro: true,
  },
]

const BUSINESSES: Array<{
  Icon: React.ComponentType<{ size?: number }>
  type: string
  quote: string
}> = [
  { Icon: IconUtensils, type: 'Taquerías y restaurantes', quote: '"Ya sé exactamente cuánto gané hoy"' },
  { Icon: IconScissors, type: 'Estéticas y salones',      quote: '"Los pendientes de pago nunca se me olvidan"' },
  { Icon: IconWrench,   type: 'Talleres mecánicos',        quote: '"El reporte mensual me lo mando yo solo"' },
  { Icon: IconStore,    type: 'Tiendas y abarrotes',       quote: '"Llevo mis cuentas en el celular, no en papel"' },
  { Icon: IconTruck,    type: 'Food trucks y puestos',     quote: '"Sé cuánto gané en cada evento o turno"' },
  { Icon: IconBriefcase,type: 'Freelancers y vendedores',  quote: '"Lo anoto mientras atiendo al cliente"' },
]

const FEATURE_HIGHLIGHTS: Array<{
  Icon: React.ComponentType<{ size?: number }>
  title: string
  body: string
}> = [
  {
    Icon: IconFileText,
    title: 'Reportes PDF mensuales',
    body: 'Genera tu estado de resultados con un tap. Compártelo por WhatsApp o descárgalo — sin Excel, sin formatos raros.',
  },
  {
    Icon: IconClock,
    title: 'Pendientes y vencimientos',
    body: 'Registra lo que debes o te deben. Fiza te los muestra en el dashboard antes de que se te pasen.',
  },
  {
    Icon: IconHistory,
    title: 'Historial completo con filtros',
    body: 'Filtra por hoy, semana, mes, año o rangos exactos. Consulta cómo ibas en cualquier período.',
  },
]

const FREE_FEATURES = [
  '10 movimientos al día',
  'Texto, voz y foto',
  'Historial de 30 días',
  'Dashboard con métricas',
  'Categorías automáticas',
]

const PRO_FEATURES = [
  'Movimientos sin límite',
  'Texto, voz y foto',
  'Historial completo',
  'Filtros avanzados y rangos personalizados',
  'Reportes PDF mensuales',
  'Pendientes y vencimientos',
  'Insights diarios inteligentes',
  'Todos tus dispositivos',
]

const CITIES = [
  { city: 'CDMX',        count: 11 },
  { city: 'Guadalajara', count: 24 },
  { city: 'Tijuana',     count: 14 },
  { city: 'Puebla',      count: 12 },
  { city: 'Monterrey',   count: 14 },
]

const FAQ = [
  {
    q: '¿Necesito saber de contabilidad?',
    a: 'Para nada. Fiza está diseñada para dueños de negocio, no para contadores. Solo dile lo que pasó en tu día en tus propias palabras — la IA se encarga de clasificar todo.',
  },
  {
    q: '¿Funciona en celular?',
    a: 'Sí, está optimizada para móvil desde el primer día. Funciona en cualquier navegador moderno — sin descargar nada de la App Store ni Google Play.',
  },
  {
    q: '¿Es seguro guardar mis finanzas aquí?',
    a: 'Sí. Tus datos se guardan con cifrado en reposo y en tránsito. Nunca compartimos ni vendemos tu información. Puedes exportar o eliminar tu cuenta cuando quieras.',
  },
  {
    q: '¿Para qué tipos de negocio funciona?',
    a: 'Para cualquier negocio pequeño: taquerías, estéticas, talleres, tiendas, food trucks, freelancers, y cualquier actividad con ingresos y gastos — en efectivo o transferencia.',
  },
  {
    q: '¿En qué se diferencia de una libreta o de Excel?',
    a: 'Una libreta no clasifica ni calcula sola. Excel requiere formatos y conocimientos técnicos. Fiza entiende lenguaje natural — escribe como le hablarías a alguien, y ella organiza todo.',
  },
  {
    q: '¿Qué pasa con mis datos si cancelo?',
    a: 'Tu cuenta continúa en el plan gratuito con acceso a los últimos 30 días. Puedes descargar tus reportes antes de cancelar. No borramos tus datos.',
  },
]

/* ─── Eyebrow label shared style ─────────────────────────────────────────── */

const eyebrowStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-500)',
}

/* ─── Section heading shared style ───────────────────────────────────────── */

const secTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.05,
  color: 'var(--ink-900)',
}

const secSubStyle: React.CSSProperties = {
  fontSize: '17px',
  lineHeight: 1.55,
  color: 'var(--ink-500)',
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [openFAQ, setOpenFAQ]   = useState<number | null>(0)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-5 shrink-0"
        style={{
          height: '60px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: scrolled ? 'rgba(252,253,248,0.92)' : 'var(--paper)',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--brand-border)' : '1px solid transparent',
          transition: `background var(--dur-std) var(--ease-standard),
                       border-color var(--dur-std) var(--ease-standard)`,
        }}
      >
        <img src="/logo-green.png" alt="fiza" style={{ height: '26px', width: 'auto', display: 'block' }} />

        <nav className="hidden md:flex items-center gap-7" aria-label="Secciones">
          {[
            { href: '#como-funciona', label: 'Cómo funciona' },
            { href: '#precios',       label: 'Precios' },
            { href: '#para-quien',    label: 'Para quién es' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium"
              style={{
                color: 'var(--ink-500)',
                transition: `color var(--dur-fast) var(--ease-standard)`,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-500)')}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden md:flex text-sm font-medium px-4 py-2 rounded-lg min-h-[36px] items-center"
            style={{ color: 'var(--ink-500)', transition: `color var(--dur-fast) var(--ease-standard)` }}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login?mode=register"
            className="text-sm font-bold px-4 py-2 rounded-lg min-h-[36px] flex items-center text-white"
            style={{
              background: 'var(--brand)',
              transition: `background var(--dur-fast) var(--ease-standard)`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#4A7359')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}
          >
            Empieza gratis
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: '#578466' }}
      >
        <div className="max-w-5xl mx-auto px-5 pt-16 pb-28 md:py-20 md:pb-32 flex flex-col md:flex-row items-center gap-10 md:gap-14">

          {/* Text */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
            {/* Main headline */}
            <h1
              className="font-bold mb-2"
              style={{
                color: '#fff',
                fontSize: 'clamp(3rem, 9vw, 5.5rem)',
                lineHeight: 0.92,
                letterSpacing: '-0.03em',
                maxWidth: '520px',
              }}
            >
              Tus cuentas,<br />sin cuentos.
            </h1>

            {/* Wave underline — Light weight (v2 design system) */}
            <WaveUnderline color="rgba(255,255,255,0.42)" />

            {/* Subtitle */}
            <p
              className="leading-relaxed mb-4"
              style={{
                color: 'rgba(255,255,255,0.88)',
                fontSize: '17px',
                lineHeight: 1.55,
                maxWidth: '420px',
              }}
            >
              Solo cuéntale lo que pasó en tu negocio.
            </p>

            {/* Example */}
            <p
              className="mb-6"
              style={{
                color: 'rgba(255,255,255,0.72)',
                fontSize: '15px',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
                fontStyle: 'italic',
                maxWidth: '420px',
              }}
            >
              “Vendí $2,000, salió $600 en materiales” — y listo, Fiza lo organiza.
            </p>

            <Link
              href="/login?mode=register"
              className="px-7 py-3.5 rounded-xl font-bold text-base text-center min-h-[52px] inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                background: 'var(--brand-lime)',
                color: '#3d6050',
                boxShadow: 'var(--sh-3)',
                transition: `transform var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)'
                e.currentTarget.style.background = '#C8D672'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'var(--brand-lime)'
              }}
            >
              Probar gratis
              <span aria-hidden="true">→</span>
            </Link>

            {/* Social proof — negocios y ciudades */}
            <div className="mt-5 w-full sm:w-auto">
              <p
                className="mb-2.5 text-center md:text-left"
                style={{
                  color: 'rgba(255,255,255,0.82)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {CITIES.reduce((s, c) => s + c.count, 0)} negocios llevando sus cuentas en{' '}
                {CITIES.length} ciudades
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                {CITIES.map(c => (
                  <div
                    key={c.city}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.22)',
                    }}
                  >
                    <span
                      className="text-xs font-semibold"
                      style={{ color: '#fff', letterSpacing: '-0.01em' }}
                    >
                      {c.city}
                    </span>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.9)',
                        color: 'var(--brand)',
                        minWidth: '18px',
                        textAlign: 'center',
                      }}
                    >
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Sin tarjeta de crédito · Cancela cuando quieras
            </p>
          </div>

          {/* iPhone mockup — video */}
          <div className="flex-shrink-0 w-full md:w-auto flex justify-center">
            <video
              src="/iphone-hero.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="App fiza en iPhone"
              style={{
                width: '100%',
                maxWidth: '340px',
                height: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.35))',
              }}
            />
          </div>
        </div>

        {/* Hero wave — filled solid transition to paper.
            Deliberate exception to the stroke-only rule: the filled shape
            creates a smooth gradient→paper flow that the hairline can't achieve. */}
        <div className="absolute bottom-0 left-0 right-0" aria-hidden="true">
          <svg viewBox="0 0 1200 52" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '52px' }}>
            <path d="M0,32 C200,52 400,12 600,28 C800,44 1000,8 1200,28 L1200,52 L0,52 Z" fill="var(--paper-2)"/>
          </svg>
        </div>
      </section>

      {/* ── Cómo funciona ───────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-14 px-4" style={{ background: 'var(--paper-2)', position: 'relative', overflow: 'hidden' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center mb-3" style={eyebrowStyle}>Cómo funciona</p>
          <h2 className="text-center mb-3" style={secTitleStyle}>
            Tan fácil como mandar un mensaje
          </h2>
          <p
            className="text-center mb-9 mx-auto"
            style={{ ...secSubStyle, maxWidth: '360px' }}
          >
            No necesitas saber de contabilidad. Solo cuéntale lo que pasó.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {STEPS.map(s => (
              <StepCard
                key={s.num}
                num={s.num}
                title={s.title}
                body={s.body}
                icon={s.Icon}
                isPro={s.isPro}
              />
            ))}
          </div>
        </div>
        <WaveDivider fill="var(--paper)" />
      </section>

      {/* ── Para negocios ───────────────────────────────────────────────────── */}
      <section id="para-quien" className="py-14 px-4" style={{ background: 'var(--paper)', position: 'relative', overflow: 'hidden' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center mb-3" style={eyebrowStyle}>Para quién es</p>
          <h2 className="text-center mb-9" style={secTitleStyle}>
            Para negocios como el tuyo
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BUSINESSES.map(b => (
              <div
                key={b.type}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--brand-border)',
                  boxShadow: 'var(--sh-1)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--brand-chip)', color: 'var(--brand)' }}
                >
                  <b.Icon size={20} />
                </div>
                <div>
                  <p
                    className="text-xs font-bold mb-1"
                    style={{ color: 'var(--ink-900)', letterSpacing: '-0.01em' }}
                  >
                    {b.type}
                  </p>
                  <p
                    className="text-xs italic leading-snug"
                    style={{ color: 'var(--ink-500)' }}
                  >
                    {b.quote}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p
            className="text-center mt-8 mx-auto italic"
            style={{ ...secSubStyle, fontSize: '15px', maxWidth: '420px' }}
          >
            Si llevas tus cuentas en un cuaderno, en tu cabeza, o en el WhatsApp de tu familia
            — fiza es para ti.
          </p>
        </div>
        <WaveDivider fill="#3d6050" />
      </section>

      {/* ── Features destacados ─────────────────────────────────────────────── */}
      <section
        className="py-14 px-4"
        style={{ background: 'linear-gradient(145deg, #3d6050 0%, #578466 100%)', position: 'relative', overflow: 'hidden' }}
      >
        <div className="max-w-4xl mx-auto">
          <p
            className="text-center mb-3"
            style={{ ...eyebrowStyle, color: 'rgba(255,255,255,0.5)' }}
          >
            Lo que hace por ti
          </p>
          <h2
            className="text-center mb-9"
            style={{ ...secTitleStyle, color: '#fff' }}
          >
            Más que registrar — fiza trabaja para ti
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURE_HIGHLIGHTS.map(f => (
              <div
                key={f.title}
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                >
                  <f.Icon size={22} />
                </div>
                <div>
                  <p
                    className="font-bold mb-2"
                    style={{ color: '#fff', fontSize: '16px', letterSpacing: '-0.01em' }}
                  >
                    {f.title}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '14px', lineHeight: 1.55 }}>
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <WaveDivider fill="var(--paper-2)" />
      </section>

      {/* ── Precios ─────────────────────────────────────────────────────────── */}
      <section id="precios" className="py-14 px-4" style={{ background: 'var(--paper-2)', position: 'relative', overflow: 'hidden' }}>
        <div className="max-w-lg mx-auto">
          <p className="text-center mb-3" style={eyebrowStyle}>Precios</p>
          <h2 className="text-center mb-2" style={secTitleStyle}>
            Simple y sin sorpresas
          </h2>
          <p className="text-center mb-10" style={{ ...secSubStyle, fontSize: '15px' }}>
            Empieza gratis, sube cuando lo necesites.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Free */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--brand-border)',
                boxShadow: 'var(--sh-1)',
              }}
            >
              <div>
                <p
                  className="text-[11px] font-bold tracking-widest mb-2"
                  style={{ color: 'var(--ink-300)', letterSpacing: '0.14em' }}
                >
                  GRATIS
                </p>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-bold"
                    style={{ color: 'var(--brand)', fontSize: '2rem', letterSpacing: '-0.02em' }}
                  >
                    $0
                  </span>
                  <span style={{ color: 'var(--ink-500)', fontSize: '14px' }}>/mes</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: 'var(--brand)', marginTop: '2px', flexShrink: 0 }}>
                      <IconCheck size={15} />
                    </span>
                    <span style={{ color: 'var(--ink-700)', fontSize: '14px', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=register"
                className="w-full py-3 rounded-xl text-sm font-semibold text-center min-h-[44px] flex items-center justify-center"
                style={{
                  borderColor: 'var(--brand)',
                  border: '1px solid var(--brand)',
                  color: 'var(--brand)',
                  transition: `background var(--dur-fast) var(--ease-standard)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--pro-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Empieza gratis
              </Link>
            </div>

            {/* Pro */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--brand-border)',
                boxShadow: 'var(--sh-1)',
              }}
            >
              <div>
                <p
                  className="text-[11px] font-bold tracking-widest mb-2"
                  style={{ color: 'var(--ink-300)', letterSpacing: '0.14em' }}
                >
                  PRO
                </p>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-bold"
                    style={{ color: 'var(--brand)', fontSize: '2rem', letterSpacing: '-0.02em' }}
                  >
                    $49
                  </span>
                  <span style={{ color: 'var(--ink-500)', fontSize: '14px' }}>/mes</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: 'var(--brand)', marginTop: '2px', flexShrink: 0 }}>
                      <IconCheck size={15} />
                    </span>
                    <span style={{ color: 'var(--ink-700)', fontSize: '14px', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=register"
                className="w-full py-3 rounded-xl text-sm font-bold text-center text-white min-h-[44px] flex items-center justify-center"
                style={{
                  background: 'var(--brand)',
                  transition: `background var(--dur-fast) var(--ease-standard)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#4A7359' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand)' }}
              >
                Probar Pro 30 días gratis
              </Link>
            </div>
          </div>

          {/* Guarantee */}
          <div
            className="mt-4 rounded-xl p-4 flex items-center gap-3"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--brand-border)',
              boxShadow: 'var(--sh-1)',
            }}
          >
            <span style={{ color: 'var(--brand)', flexShrink: 0 }}>
              <IconShield size={20} />
            </span>
            <p style={{ color: 'var(--ink-700)', fontSize: '13px', lineHeight: 1.55 }}>
              <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>Garantía de 30 días.</span>{' '}
              Si en el primer mes no le encuentras utilidad, te devolvemos tu dinero — sin preguntas.
            </p>
          </div>

          <p className="text-xs text-center mt-3" style={{ color: 'var(--ink-300)' }}>
            Cancela cuando quieras · Sin permanencia · Sin letra chica
          </p>
        </div>
        <WaveDivider fill="var(--paper)" />
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-14 px-4" style={{ background: 'var(--paper)', position: 'relative', overflow: 'hidden' }}>
        <div className="max-w-xl mx-auto">
          <p className="text-center mb-3" style={eyebrowStyle}>Preguntas frecuentes</p>
          <h2 className="text-center mb-8" style={secTitleStyle}>
            ¿Tienes dudas?
          </h2>
          <div className="flex flex-col gap-2.5">
            {FAQ.map((item, i) => (
              <FAQItem
                key={i}
                q={item.q}
                a={item.a}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
        <WaveDivider fill="var(--brand)" />
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="pt-12 pb-8 px-5" style={{ background: 'var(--brand)' }}>
        <div className="max-w-4xl mx-auto">

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
            {/* Brand */}
            <div className="flex flex-col items-start gap-2">
              <img
                src="/logo-white.png"
                alt="fiza"
                style={{ height: '28px', width: 'auto', display: 'block' }}
              />
              <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '14px', lineHeight: 1.5, maxWidth: '240px' }}>
                La forma más fácil de llevar las cuentas de tu negocio.
              </p>
              {/* Social links */}
              <div className="flex gap-2 mt-1">
                <a
                  href="https://www.facebook.com/profile.php?id=61564510411949"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Fiza en Facebook"
                  className="p-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    transition: `opacity var(--dur-fast) var(--ease-standard)`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  <IconFacebook size={18} />
                </a>
                <a
                  href="https://www.instagram.com/fiza_finanzasfaciles?igsh=MXVzcmJ0MmI4a29pNA%3D%3D&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Fiza en Instagram"
                  className="p-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    transition: `opacity var(--dur-fast) var(--ease-standard)`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  <IconInstagram size={18} />
                </a>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
              {[
                { label: 'Privacidad', href: '/privacidad' },
                { label: 'Términos',   href: '/terminos' },
                { label: 'Contacto',   href: 'mailto:hola@fiza.mx' },
              ].map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm"
                  style={{
                    color: 'rgba(255,255,255,0.72)',
                    transition: `opacity var(--dur-fast) var(--ease-standard)`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.5' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              © 2026 fiza.mx — Todos los derechos reservados
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              Hecho en México 🇲🇽
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
