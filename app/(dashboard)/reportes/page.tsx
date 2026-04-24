'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { MOVEMENT_TYPE_CONFIG, PLANS } from '@/lib/constants'
import type { Movement } from '@/types'

// react-pdf solo client-side
const PdfDownloadButton = dynamic(
  () => import('@/components/reports/pdf-download-button'),
  { ssr: false, loading: () => (
    <div className="w-full py-3.5 rounded-xl flex items-center justify-center"
      style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}>
      <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Preparando PDF...</p>
    </div>
  )}
)

type Tab = 'periodo' | 'comparar' | 'tendencia'

function getMonthStr(d: Date): string { return d.toISOString().slice(0, 7) }

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

// Mes más viejo permitido para Free: mes actual menos (historyMonths - 1).
function earliestAllowedMonth(plan: 'free' | 'pro'): string | null {
  if (plan === 'pro') return null
  const today = new Date()
  const earliest = new Date(today.getFullYear(), today.getMonth() - (PLANS.FREE.historyMonths - 1), 1)
  return getMonthStr(earliest)
}

export default function ReportesPage() {
  const { profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('periodo')
  const [month, setMonth] = useState(getMonthStr(new Date()))
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const plan = profile?.plan ?? 'free'
  const earliestMonth = useMemo(() => earliestAllowedMonth(plan), [plan])
  const currentMonthStr = getMonthStr(new Date())
  const atEarliest = earliestMonth !== null && month <= earliestMonth
  const atCurrent = month >= currentMonthStr

  const fetchMovements = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/movements?month=${encodeURIComponent(m)}`)
      if (!res.ok) {
        setMovements([])
        setBlocked(false)
        return
      }
      const json = await res.json() as { movements: Movement[]; truncated?: boolean; blocked?: boolean }
      setMovements(json.movements ?? [])
      setBlocked(Boolean(json.blocked ?? json.truncated))
    } catch (err) {
      console.error('[reportes] fetch error', err)
      setMovements([])
      setBlocked(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile) fetchMovements(month)
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function changeMonth(target: string) {
    // Free: no permitir ir antes del cap; el server también lo enforça pero
    // el cliente da feedback inmediato.
    if (earliestMonth && target < earliestMonth) return
    if (target > currentMonthStr) return
    setMonth(target)
    fetchMovements(target)
  }

  // ── Métricas (calculadas client-side, excluyen inversiones) ─────────────
  let income = 0
  let expenses = 0
  for (const m of movements) {
    if (m.isInvestment) continue
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  const net = income - expenses

  // ── Hamburger menu ──────────────────────────────────────────────────────
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
      {/* ── Header ───────────────────────────────────────────────────────── */}
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
        {/* ── Title ── */}
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--brand)' }}>Reportes</h1>
          <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Resumen, comparación y tendencia de tu negocio</p>
        </div>

        {/* ── Tabs ── */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
          role="tablist"
          aria-label="Vistas de reportes"
        >
          {([
            { id: 'periodo',   label: 'Este período' },
            { id: 'comparar',  label: '¿Cómo voy?' },
            { id: 'tendencia', label: 'Tendencia' },
          ] as Array<{ id: Tab; label: string }>).map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="flex-1 text-xs font-bold rounded-lg min-h-[36px] px-2 transition-colors"
                style={{
                  background: active ? 'var(--brand)' : 'transparent',
                  color: active ? '#fff' : 'var(--brand-mid)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Selector de período (compartido entre vistas) ── */}
        <div
          className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between"
          style={{ border: '1px solid var(--brand-border)' }}
        >
          <button
            type="button"
            onClick={() => changeMonth(prevMonth(month))}
            disabled={atEarliest}
            title={atEarliest && earliestMonth ? 'Actualiza a Pro para ver más meses atrás' : 'Mes anterior'}
            className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
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
            disabled={atCurrent}
            className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
            style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
            aria-label="Mes siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* ── Banner cuando un Free pidió un mes fuera del cap (defense-in-depth;
              el botón ya está disabled, pero por si llega via deeplink/etc) ── */}
        {blocked && plan === 'free' && (
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'var(--pending-bg)', border: '1px solid var(--pending-border)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--pending-text)', flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--pending-text)' }}>
              <strong>Plan Free:</strong> los reportes están disponibles solo para los últimos 3 meses. Actualiza a Pro para acceder a todo tu historial.
            </div>
          </div>
        )}

        {/* ── Vista 1 — Este período ── */}
        {tab === 'periodo' && (
          <>
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

                {/* Acciones de exportación */}
                {movements.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center" style={{ border: '1px solid var(--brand-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>
                      {blocked ? 'Este mes no está disponible en tu plan.' : 'Sin movimientos en este mes.'}
                    </p>
                  </div>
                ) : profile ? (
                  <div className="flex flex-col gap-2">
                    <PdfDownloadButton
                      month={month}
                      movements={movements}
                      displayName={profile.displayName}
                      giro={profile.giro}
                    />
                    {/* Excel: visible siempre, deshabilitado para Free con tooltip */}
                    <button
                      type="button"
                      disabled
                      title={plan === 'pro' ? 'Disponible en Fase 5' : 'Disponible en Pro'}
                      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px] cursor-not-allowed"
                      style={{
                        background: 'var(--brand-chip)',
                        border: '1px solid var(--brand-border)',
                        color: 'var(--brand-mid)',
                        opacity: 0.7,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Descargar Excel
                      {plan === 'free' && (
                        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--brand)', color: '#fff', letterSpacing: '0.05em' }}>
                          PRO
                        </span>
                      )}
                    </button>
                  </div>
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
          </>
        )}

        {/* ── Vista 2 — ¿Cómo voy? (placeholder Fase 3) ── */}
        {tab === 'comparar' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center flex flex-col gap-3 items-center"
            style={{ border: '1px solid var(--brand-border)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--brand-chip)', color: 'var(--brand)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--brand)' }}>Próximamente</p>
              <p className="text-xs mt-1" style={{ color: 'var(--brand-mid)' }}>
                Compara tu desempeño contra períodos anteriores.
              </p>
            </div>
          </div>
        )}

        {/* ── Vista 3 — Tendencia (placeholder Fase 4) ── */}
        {tab === 'tendencia' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center flex flex-col gap-3 items-center"
            style={{ border: '1px solid var(--brand-border)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--brand-chip)', color: 'var(--brand)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="14 7 21 7 21 14" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--brand)' }}>Próximamente</p>
              <p className="text-xs mt-1" style={{ color: 'var(--brand-mid)' }}>
                Visualiza la evolución de tu negocio en el tiempo.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
