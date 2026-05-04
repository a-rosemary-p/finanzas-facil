'use client'

/**
 * CategoryPies — dos pies lado a lado: Ingresos por categoría / Gastos por
 * categoría. Para la pestaña "¿Cómo voy?" de /reportes (v0.29).
 *
 * Permite identificar de un vistazo cuál categoría representa el grueso de
 * los ingresos y cuál de los gastos en el período seleccionado.
 *
 * Datos: byCategory que viene de /api/reports/period-summary.
 *
 * Categorías ordenadas por monto descendente. Top 5 individuales + un
 * "Otros" que agrupa el resto cuando hay > 5 categorías (evita que el pie
 * se convierta en confeti ilegible).
 */

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ByCategory {
  [cat: string]: { income: number; expenses: number }
}

interface Props {
  byCategory: ByCategory
  loading: boolean
}

// Paleta para slices — matchea brand pero diferenciable. Ingresos en verdes,
// gastos en rojos/naranjas. Los colores secundarios son derivados de la
// paleta del DS para mantener cohesión visual.
const INCOME_COLORS = ['#578466', '#92C3A5', '#DAE68F', '#8AAB94', '#6B8C78', '#C9D4CC']
const EXPENSE_COLORS = ['#D0481A', '#F79366', '#FAD5BF', '#FFCE57', '#B89010', '#C9D4CC']

const MAX_SLICES = 5

export function CategoryPies({ byCategory, loading }: Props) {
  const incomeSlices = useMemo(() => buildSlices(byCategory, 'income'), [byCategory])
  const expenseSlices = useMemo(() => buildSlices(byCategory, 'expense'), [byCategory])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-brand-border p-4">
        <p className="text-sm text-brand-mid text-center">Cargando categorías...</p>
      </div>
    )
  }

  const noData = incomeSlices.length === 0 && expenseSlices.length === 0
  if (noData) {
    return (
      <div className="bg-white rounded-2xl border border-brand-border p-4 text-center">
        <p className="text-sm text-brand-mid">Sin movimientos en este período.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <PieCard
        title="Ingresos"
        slices={incomeSlices}
        colors={INCOME_COLORS}
        emptyText="Sin ingresos"
        accentClass="text-income-text"
      />
      <PieCard
        title="Gastos"
        slices={expenseSlices}
        colors={EXPENSE_COLORS}
        emptyText="Sin gastos"
        accentClass="text-expense-text"
      />
    </div>
  )
}

interface Slice {
  name: string
  value: number
}

function buildSlices(byCategory: ByCategory, kind: 'income' | 'expense'): Slice[] {
  const entries = Object.entries(byCategory)
    .map(([cat, v]) => ({ name: cat, value: kind === 'income' ? v.income : v.expenses }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)

  if (entries.length <= MAX_SLICES) return entries

  const top = entries.slice(0, MAX_SLICES - 1)
  const rest = entries.slice(MAX_SLICES - 1)
  const otrosTotal = rest.reduce((sum, s) => sum + s.value, 0)
  return [...top, { name: 'Otros', value: otrosTotal }]
}

// ──────────────────────────────────────────────────────────────────────────

interface PieCardProps {
  title: string
  slices: Slice[]
  colors: string[]
  emptyText: string
  accentClass: string
}

function PieCard({ title, slices, colors, emptyText, accentClass }: PieCardProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="bg-white rounded-2xl border border-brand-border p-3 flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <p className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>
          {title}
        </p>
        {total > 0 && (
          <p className={`text-xs font-bold tabular-nums ${accentClass}`}>
            {formatCurrency(total)}
          </p>
        )}
      </div>

      {slices.length === 0 ? (
        <div className="h-32 flex items-center justify-center">
          <p className="text-xs text-brand-mid">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="h-28">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={48}
                  innerRadius={20}
                  paddingAngle={1}
                  stroke="white"
                  strokeWidth={1}
                >
                  {slices.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid var(--brand-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => {
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0
                    return [`${formatCurrency(value)} · ${pct}%`, name]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Leyenda compacta — top categorías con su % */}
          <ul className="flex flex-col gap-0.5 mt-1">
            {slices.slice(0, 4).map((s, i) => {
              const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
              return (
                <li key={s.name} className="flex items-center gap-1.5 text-[10px] text-ink-700">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: colors[i % colors.length] }}
                  />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-brand-mid">{pct}%</span>
                </li>
              )
            })}
            {slices.length > 4 && (
              <li className="text-[10px] text-ink-300 italic">
                + {slices.length - 4} más
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
