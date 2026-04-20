'use client'

import { useRouter } from 'next/navigation'

interface UnderConstructionProps {
  title: string
  icon: string
}

export function UnderConstruction({ title, icon }: UnderConstructionProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      {/* Header */}
      <header
        className="bg-white sticky top-0 z-10 flex items-center gap-3 px-4"
        style={{
          borderBottom: '1px solid var(--brand-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px',
          minHeight: '56px',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px] transition-colors"
          style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
          aria-label="Regresar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="font-bold text-lg" style={{ color: 'var(--brand)' }}>{title}</span>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 flex flex-col items-center justify-center text-center gap-6"
        style={{ paddingTop: '15vh', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Icon stack */}
        <div className="relative flex items-center justify-center w-28 h-28">
          <div className="absolute inset-0 rounded-full opacity-20" style={{ background: 'var(--brand)' }} />
          <div className="absolute inset-3 rounded-full opacity-30" style={{ background: 'var(--brand)' }} />
          <span className="text-5xl relative z-10">{icon}</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>
            En construcción 🚧
          </h1>
          <p className="text-base font-medium" style={{ color: 'var(--brand-mid)' }}>
            Estamos trabajando para<br />facilitarte el negocio.
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
            Esta sección llegará pronto — nos vemos aquí.
          </p>
        </div>

        {/* Progress bar decoration */}
        <div className="w-48 flex flex-col gap-2">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--brand-border)' }}>
            <div className="h-full rounded-full" style={{ width: '35%', background: 'var(--brand-light)' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>35% completado</p>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-2 px-6 py-3 rounded-xl font-bold text-sm text-white min-h-[48px] transition-opacity"
          style={{ background: 'var(--brand)' }}
        >
          ← Regresar al dashboard
        </button>
      </main>
    </div>
  )
}
