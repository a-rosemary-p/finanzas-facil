'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { MOVEMENT_TYPE_CONFIG } from '@/lib/constants'
import type { Movement } from '@/types'

// react-pdf only works client-side — load the button as one dynamic unit
const PdfDownloadButton = dynamic(
  () => import('@/components/reports/pdf-download-button'),
  { ssr: false, loading: () => (
    <div className="w-full py-3.5 rounded-xl flex items-center justify-center"
      style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
      <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Preparando PDF...</p>
    </div>
  )}
)

function getMonthStr(d: Date): string {
  return d.toISOString().slice(0, 7) // YYYY-MM
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const raw = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return getMonthStr(new Date(y, m - 2, 1))
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return getMonthStr(new Date(y, m, 1))
}

export default function ReportesPage() {
  const { profile, loading: authLoading } = useAuth()
  const [month, setMonth] = useState(getMonthStr(new Date()))
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMovements = useCallback(async (m: string) => {
    setLoading(true)
    const [y, mo] = m.split('-').map(Number)
    const start = `${y}-${String(mo).padStart(2, '0')}-01`
    const lastDay = new Date(y, mo, 0).getDate()
    const end = `${y}-${String(mo).padStart(2, '0')}-${lastDay}`

    const supabase = createClient()
    const { data } = await supabase
      .from('movements')
      .select('id, type, amount, description, category, movement_date, is_investment')
      .gte('movement_date', start)
      .lte('movement_date', end)
      .order('movement_date', { ascending: false })
      .order('id', { ascending: false })

    setMovements((data ?? []).map(r => ({
      id: r['id'] as string,
      type: r['type'] as Movement['type'],
      amount: Number(r['amount']),
      description: r['description'] as string,
      category: r['category'] as Movement['category'],
      movementDate: r['movement_date'] as string,
      isInvestment: (r['is_investment'] as boolean) ?? false,
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profile) fetchMovements(month)
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function changeMonth(newMonth: string) {
    setMonth(newMonth)
    fetchMovements(newMonth)
  }

  // Metrics (exclude investments from totals)
  let income = 0
  let expenses = 0
  for (const m of movements) {
    if (m.isInvestment) continue
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  const net = income - expenses
  const currentMonthStr = getMonthStr(new Date())

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          borderBottom: '1px solid var(--brand-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px', minHeight: '56px',
        }}
      >
        <a href="/dashboard">
          <img src="/logo-green.png" alt="fiza" style={{ height: '32px', width: 'auto' }} />
        </a>

        {/* Hamburger menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex flex-col items-center justify-center gap-[5px] rounded-lg min-h-[44px] min-w-[44px] transition-colors"
            style={{ background: menuOpen ? 'var(--brand-chip)' : 'transparent', border: '1px solid var(--brand-border)' }}
            aria-label="Menú"
          >
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
            <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'var(--brand-mid)' }} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
              style={{ border: '1px solid var(--brand-border)', top: '100%' }}>
              {[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Perfil', href: '/perfil' },
                { label: 'Ajustes', href: '/ajustes' },
                { label: 'Reportes', href: '/reportes' },
              ].map(item => (
                <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--brand-chip)] min-h-[48px]"
                  style={{ color: 'var(--brand)' }}>
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Title */}
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--brand)' }}>Reportes</h1>
          <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Exporta tu resumen mensual en PDF</p>
        </div>

        {/* Month selector */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between"
          style={{ border: '1px solid var(--brand-border)' }}>
          <button
            type="button"
            onClick={() => changeMonth(prevMonth(month))}
            className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
            aria-label="Mes anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span className="font-bold text-base" style={{ color: 'var(--brand)' }}>
            {monthLabel(month)}
          </span>

          <button
            type="button"
            onClick={() => changeMonth(nextMonth(month))}
            disabled={month >= currentMonthStr}
            className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
            style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
            aria-label="Mes siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--brand-mid)' }}>Cargando movimientos...</p>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ingresos', value: income, color: '#578466', bg: '#DAE68F', border: '#92C3A5', sign: '+' },
                { label: 'Gastos', value: expenses, color: '#D0481A', bg: '#FAD5BF', border: '#F79366', sign: '−' },
                { label: 'Neto', value: Math.abs(net), color: net >= 0 ? '#578466' : '#D0481A', bg: net >= 0 ? '#DAE68F' : '#FAD5BF', border: net >= 0 ? '#92C3A5' : '#F79366', sign: net >= 0 ? '+' : '−' },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-3 flex flex-col gap-1"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: c.color }}>{c.label}</p>
                  <p className="text-sm font-bold leading-tight" style={{ color: c.color }}>
                    {c.sign}{formatCurrency(c.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Download button or empty state */}
            {movements.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center" style={{ border: '1px solid var(--brand-border)' }}>
                <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Sin movimientos en este mes.</p>
              </div>
            ) : profile ? (
              <PdfDownloadButton
                month={month}
                movements={movements}
                displayName={profile.displayName}
                giro={profile.giro}
              />
            ) : null}

            {/* Movement preview list */}
            {movements.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--brand-muted)' }}>
                  Movimientos del mes ({movements.length})
                </h3>
                <div className="flex flex-col gap-1.5">
                  {movements.map(m => {
                    const cfg = MOVEMENT_TYPE_CONFIG[m.type]
                    return (
                      <div key={m.id} className="bg-white rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-sm"
                        style={{ border: '1px solid var(--brand-border)' }}>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {cfg.label}
                        </span>
                        <p className="flex-1 text-sm truncate" style={{ color: 'var(--brand)' }}>{m.description}</p>
                        <span className="text-sm font-bold shrink-0" style={{ color: cfg.color }}>
                          {cfg.sign}{formatCurrency(m.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
