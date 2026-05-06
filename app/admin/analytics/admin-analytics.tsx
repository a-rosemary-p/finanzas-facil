'use client'

/**
 * AdminAnalytics — client component que renderiza el dashboard de founders.
 * Recibe data ya agregada del server component y solo se encarga del render
 * + interacción (botón Actualizar via router.refresh()).
 *
 * Estilo: usa los tokens y clases ya existentes (bg-white, brand-border,
 * brand-chip, ink-300, etc.) para consistencia con el resto del app.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface KPIs {
  totalUsers: number
  newUsers7d: number
  activatedUsers: number
  retainedUsers: number
  churnedOnboard: number
  proUsers: number
  freeUsers: number
  totalMovements: number
  movementsTodayN: number
  avgMovsPerActive: number
  avgHoursToFirstMov: number
  activeUsers7d: number
  activeUsers30d: number
  inputSourceCounts: Record<string, number>
  proActive: number
  trialActive: number
  mrrEstimate: number
  recurringCount: number
}

interface RecentUser {
  id: string
  email: string
  displayName: string
  createdAt: string
  plan: 'free' | 'pro'
  subscriptionStatus: string
  totalMovements: number
  lastMovementAt: string | null
  giro: string | null
}

interface Props {
  generatedAt: string
  kpis: KPIs
  charts: {
    signupsByDay: Array<{ date: string; count: number }>
    movementsByDay: Array<{ date: string; count: number }>
  }
  recentUsers: RecentUser[]
}

const COLORS = {
  brand:    '#578466',
  expense:  '#D0481A',
  netoSoft: '#7891A0',
  netoStrong: '#2E5266',
  pending:  '#B89010',
  brandLight: '#92C3A5',
  ink300:   '#A3B0AA',
}

const INPUT_SRC_COLORS: Record<string, string> = {
  text:  COLORS.brand,
  voice: COLORS.netoStrong,
  photo: COLORS.expense,
}

export function AdminAnalytics({ generatedAt, kpis, charts, recentUsers }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function refresh() {
    startTransition(() => {
      router.refresh()
    })
  }

  const inputSourceData = Object.entries(kpis.inputSourceCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: capLabel(k), value: v, key: k }))

  const planData = [
    { name: 'Free', value: kpis.freeUsers, key: 'free' },
    { name: 'Pro',  value: kpis.proUsers,  key: 'pro' },
  ].filter(d => d.value > 0)

  return (
    <div className="min-h-screen fz-page-gradient">
      <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-xl text-brand">Admin · Analytics</h1>
            <p className="text-xs mt-1 text-brand-mid">
              Dashboard interno · Actualizado {fmtRelative(generatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand text-white disabled:opacity-60"
          >
            {pending ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {/* ── Sección 1: KPIs ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="fz-eyebrow">Usuarios</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Total registrados"    value={kpis.totalUsers} />
            <Stat label="Nuevos 7 días"        value={kpis.newUsers7d} />
            <Stat label="Activados (≥1 mov)"   value={kpis.activatedUsers}
                  hint={pct(kpis.activatedUsers, kpis.totalUsers)} />
            <Stat label="Retenidos (3+ días)"  value={kpis.retainedUsers}
                  hint={pct(kpis.retainedUsers, kpis.totalUsers)} />
            <Stat label="Perdidos onboarding"  value={kpis.churnedOnboard}
                  hint={pct(kpis.churnedOnboard, kpis.totalUsers)} />
            <Stat label="Free"                  value={kpis.freeUsers} />
            <Stat label="Pro"                   value={kpis.proUsers} accent="text-brand" />
            <Stat label="Trial activo"          value={kpis.trialActive} accent="text-pending-text" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="fz-eyebrow">Uso del producto</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Mov totales"            value={kpis.totalMovements} />
            <Stat label="Mov hoy"                value={kpis.movementsTodayN} />
            <Stat label="Promedio mov/activo"    value={fmt1(kpis.avgMovsPerActive)} />
            <Stat label="Horas al 1er mov"       value={fmt1(kpis.avgHoursToFirstMov)} />
            <Stat label="Activos 7d"             value={kpis.activeUsers7d} />
            <Stat label="Activos 30d"            value={kpis.activeUsers30d} />
            <Stat label="Recurrentes activos"    value={kpis.recurringCount} />
            <Stat label="Texto / Voz / Foto"
              value={`${kpis.inputSourceCounts.text ?? 0} / ${kpis.inputSourceCounts.voice ?? 0} / ${kpis.inputSourceCounts.photo ?? 0}`}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="fz-eyebrow">Negocio</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Pro activos"            value={kpis.proActive} accent="text-brand" />
            <Stat label="Trial activos"          value={kpis.trialActive} accent="text-pending-text" />
            <Stat label="MRR estimado"           value={`$${kpis.mrrEstimate.toLocaleString('es-MX')}`}
                  accent="text-brand" hint={`Pro × $49`} />
          </div>
        </section>

        {/* ── Sección 2: Charts ───────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="fz-eyebrow">Tendencias</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChartCard title="Registros por día (30d)">
              <ResponsiveContainer>
                <BarChart data={charts.signupsByDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--ink-100)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.ink300 }} axisLine={false} tickLine={false}
                    tickFormatter={shortDate} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.ink300 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v) => shortDate(String(v ?? ''))} />
                  <Bar dataKey="count" name="Registros" fill={COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Movimientos por día (30d)">
              <ResponsiveContainer>
                <LineChart data={charts.movementsByDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--ink-100)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.ink300 }} axisLine={false} tickLine={false}
                    tickFormatter={shortDate} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.ink300 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v) => shortDate(String(v ?? ''))} />
                  <Line type="monotone" dataKey="count" name="Movimientos" stroke={COLORS.netoStrong}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribución por input">
              {inputSourceData.length === 0 ? (
                <EmptyChart>Sin entradas todavía</EmptyChart>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={inputSourceData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={70} innerRadius={40} stroke="none">
                      {inputSourceData.map(d => (
                        <Cell key={d.key} fill={INPUT_SRC_COLORS[d.key] ?? COLORS.ink300} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <Legend
                items={inputSourceData.map(d => ({
                  label: d.name,
                  color: INPUT_SRC_COLORS[d.key] ?? COLORS.ink300,
                  value: d.value,
                }))}
              />
            </ChartCard>

            <ChartCard title="Free vs Pro">
              {planData.length === 0 ? (
                <EmptyChart>Sin usuarios</EmptyChart>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={70} innerRadius={40} stroke="none">
                      <Cell fill={COLORS.brandLight} />
                      <Cell fill={COLORS.brand} />
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <Legend
                items={planData.map((d, i) => ({
                  label: d.name,
                  color: i === 0 ? COLORS.brandLight : COLORS.brand,
                  value: d.value,
                }))}
              />
            </ChartCard>
          </div>
        </section>

        {/* ── Sección 3: Tabla últimos 20 ─────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="fz-eyebrow">Últimos 20 registros</h2>
          <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-chip text-brand-mid uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-bold">Email</th>
                    <th className="px-3 py-2 font-bold">Registro</th>
                    <th className="px-3 py-2 font-bold">Plan</th>
                    <th className="px-3 py-2 font-bold text-right">Movs</th>
                    <th className="px-3 py-2 font-bold">Último mov</th>
                    <th className="px-3 py-2 font-bold">Giro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {recentUsers.map(u => (
                    <tr key={u.id} className="hover:bg-paper-2">
                      <td className="px-3 py-2 font-medium text-ink-700">
                        <div className="truncate max-w-[200px]" title={u.email}>{u.email}</div>
                        {u.displayName && (
                          <div className="text-ink-300 text-[10px] truncate max-w-[200px]">{u.displayName}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-brand-mid whitespace-nowrap">{shortDate(u.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span className={[
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold',
                          u.plan === 'pro'
                            ? 'bg-brand text-white'
                            : 'bg-brand-chip text-brand-mid border border-brand-border',
                        ].join(' ')}>
                          {u.plan === 'pro' ? 'PRO' : 'Free'}
                        </span>
                        {u.subscriptionStatus === 'trialing' && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-pending-bg text-pending-text border border-pending-border">
                            TRIAL
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-right">{u.totalMovements}</td>
                      <td className="px-3 py-2 text-brand-mid whitespace-nowrap">
                        {u.lastMovementAt ? shortDate(u.lastMovementAt) : '—'}
                      </td>
                      <td className="px-3 py-2 text-ink-700">
                        <div className="truncate max-w-[140px]" title={u.giro ?? ''}>
                          {u.giro ?? '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-brand-mid">
                        Sin registros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({
  label, value, hint, accent,
}: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-brand-border p-3 flex flex-col gap-0.5">
      <p className="text-[10px] uppercase tracking-wide font-bold text-brand-mid">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${accent ?? 'text-brand'}`}>{value}</p>
      {hint && <p className="text-[10px] text-ink-300">{hint}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-brand-border p-3 flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-mid">{title}</p>
      <div className="h-44">{children}</div>
    </div>
  )
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-brand-mid">{children}</p>
    </div>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string; value: number }> }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {items.map(i => {
        const p = total > 0 ? Math.round((i.value / total) * 100) : 0
        return (
          <li key={i.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: i.color }} />
            <span className="text-ink-700 font-medium">{i.label}</span>
            <span className="text-brand-mid tabular-nums">{i.value} · {p}%</span>
          </li>
        )
      })}
    </ul>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────

function pct(num: number, den: number): string {
  if (den === 0) return '0%'
  return `${Math.round((num / den) * 100)}%`
}

function fmt1(n: number): string {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

function shortDate(iso: string): string {
  // Acepta "YYYY-MM-DD" o ISO completo. Output "DD/MM"
  const ymd = iso.length >= 10 ? iso.slice(0, 10) : iso
  const [, m, d] = ymd.split('-')
  return `${d}/${m}`
}

function fmtRelative(iso: string): string {
  const t = new Date(iso)
  return t.toLocaleString('es-MX', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function capLabel(k: string): string {
  if (k === 'text')  return 'Texto'
  if (k === 'voice') return 'Voz'
  if (k === 'photo') return 'Foto'
  return k.charAt(0).toUpperCase() + k.slice(1)
}

const tooltipStyle = {
  contentStyle: {
    background: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(14,23,17,0.10)',
  },
  labelStyle: { color: '#578466', fontWeight: 600, marginBottom: 4 },
} as const
