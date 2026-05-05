/**
 * GET /api/reports/period-summary (v0.29)
 *
 * Alimenta la pestaña "Este período" del rediseño de /reportes:
 *  - Totales actuales (ingresos, gastos, neto)
 *  - Totales del período anterior equivalente — para las flechitas %Δ
 *  - Time series (buckets dentro del período) — para la gráfica I/G/Neto en el tiempo
 *
 * Calendario, no rolling: si mode='month' y anchor='2026-05-15', current = mayo
 * completo, previous = abril completo. Diferente del clásico /api/reports/compare
 * que es rolling (últimos N días).
 *
 * Granularidad de buckets según el mode:
 *   week    → 7 daily (lun-dom)
 *   month   → 28-31 daily (1 al último)
 *   quarter → ~13 weekly (lun-dom dentro del trimestre)
 *   year    → 12 monthly (ene-dic)
 *
 * Inversiones se EXCLUYEN del agregado (igual que el resto de la app).
 * Pendientes filtrados a SQL.
 *
 * Plan enforcement: igual al resto de /api/reports — Free capa a último 3 meses
 * en mode=month, los otros modos son Pro-only desde la UI (este endpoint deja
 * pasar pero la UI no muestra el control para Free).
 */

import { createClient } from '@/lib/supabase/server'
import {
  fmtYMD,
  periodRange,
  prevPeriod,
  type PeriodMode,
  type PeriodSelection,
} from '@/lib/periods'

const VALID_MODES: PeriodMode[] = ['week', 'month', 'quarter', 'year']

interface Totals {
  income: number
  expenses: number
  net: number
}

interface ByCategory {
  [cat: string]: { income: number; expenses: number }
}

interface Bucket {
  label: string  // ej "1 may", "Sem 18", "May"
  start: string  // YYYY-MM-DD
  end: string
  income: number
  expenses: number
  net: number
}

const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const modeRaw = searchParams.get('mode')
  const anchorRaw = searchParams.get('anchor') ?? fmtYMD(new Date())

  if (!modeRaw || !VALID_MODES.includes(modeRaw as PeriodMode)) {
    return Response.json({ error: 'mode inválido (week|month|quarter|year)' }, { status: 400 })
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(anchorRaw)) {
    return Response.json({ error: 'anchor inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const mode = modeRaw as PeriodMode
  const period: PeriodSelection = { mode, anchor: anchorRaw }
  const previous = prevPeriod(period)

  const currentRange = periodRange(period)
  const previousRange = periodRange(previous)

  // Una sola query cubre AMBOS rangos (más eficiente que dos round-trips)
  const queryStart = previousRange.start < currentRange.start ? previousRange.start : currentRange.start
  const queryEnd = currentRange.end

  const { data: rows, error } = await supabase
    .from('movements')
    .select('type, amount, category, movement_date, is_investment')
    .eq('user_id', user.id)
    .gte('movement_date', queryStart)
    .lte('movement_date', queryEnd)
    .in('type', ['ingreso', 'gasto'])

  if (error) {
    console.error('[GET /api/reports/period-summary]', error)
    return Response.json({ error: 'Error al cargar datos' }, { status: 500 })
  }

  const movs = (rows ?? []).map(r => ({
    type: r['type'] as string,
    amount: Number(r['amount']),
    category: r['category'] as string,
    movement_date: r['movement_date'] as string,
    is_investment: (r['is_investment'] as boolean | null) ?? false,
  }))

  // Particionar por rango y excluir inversiones
  const inCurrent = movs.filter(m => m.movement_date >= currentRange.start && m.movement_date <= currentRange.end && !m.is_investment)
  const inPrevious = movs.filter(m => m.movement_date >= previousRange.start && m.movement_date <= previousRange.end && !m.is_investment)

  const current = aggregate(inCurrent)
  const prev = aggregate(inPrevious)
  const byCategory = aggregateByCategory(inCurrent)

  // Time series — mismas buckets para current y previous (alineadas por índice).
  // Para "¿Cómo voy?" pintamos current vs previous overlapped y queremos que
  // el bucket N de un período corresponda al bucket N del otro: día 1 vs día 1,
  // semana 1 vs semana 1, mes 1 vs mes 1.
  const buckets = computeBuckets(mode, currentRange.start, currentRange.end, inCurrent)
  const previousBuckets = computeBuckets(mode, previousRange.start, previousRange.end, inPrevious)

  return Response.json({
    mode,
    anchor: anchorRaw,
    current,
    previous: prev,
    range: currentRange,
    previousRange,
    buckets,
    previousBuckets,
    byCategory,
  })
}

function aggregate(movs: Array<{ type: string; amount: number }>): Totals {
  let income = 0
  let expenses = 0
  for (const m of movs) {
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  return { income, expenses, net: income - expenses }
}

function aggregateByCategory(movs: Array<{ type: string; amount: number; category: string }>): ByCategory {
  const out: ByCategory = {}
  for (const m of movs) {
    if (!out[m.category]) out[m.category] = { income: 0, expenses: 0 }
    if (m.type === 'ingreso') out[m.category].income += m.amount
    else if (m.type === 'gasto') out[m.category].expenses += m.amount
  }
  return out
}

function computeBuckets(
  mode: PeriodMode,
  start: string,
  end: string,
  movs: Array<{ type: string; amount: number; movement_date: string }>,
): Bucket[] {
  const startD = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')

  // Generar buckets vacíos según granularidad
  const buckets: Bucket[] = []

  if (mode === 'week' || mode === 'month') {
    // Daily buckets
    const cursor = new Date(startD)
    while (cursor <= endD) {
      const ymd = fmtDateOnly(cursor)
      const label = mode === 'week'
        ? dayLabel(cursor)
        : `${cursor.getDate()} ${SHORT_MONTHS_ES[cursor.getMonth()]}`
      buckets.push({ label, start: ymd, end: ymd, income: 0, expenses: 0, net: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (mode === 'quarter') {
    // Weekly buckets (lun-dom dentro del trimestre)
    // Encontrar el lunes de la semana del start
    const cursor = new Date(startD)
    const dow = cursor.getDay()
    const offsetToMonday = dow === 0 ? -6 : 1 - dow
    cursor.setDate(cursor.getDate() + offsetToMonday)
    let weekIdx = 1
    while (cursor <= endD) {
      const weekStart = new Date(cursor)
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      // Cap weekEnd al endD del período
      const effectiveEnd = weekEnd > endD ? endD : weekEnd
      // Cap weekStart al startD del período (primera semana puede empezar antes)
      const effectiveStart = weekStart < startD ? startD : weekStart
      buckets.push({
        label: `Sem ${weekIdx}`,
        start: fmtDateOnly(effectiveStart),
        end: fmtDateOnly(effectiveEnd),
        income: 0,
        expenses: 0,
        net: 0,
      })
      cursor.setDate(cursor.getDate() + 7)
      weekIdx++
    }
  } else if (mode === 'year') {
    // 12 monthly buckets ene-dic del anchor year
    const year = startD.getFullYear()
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1)
      const monthEnd = new Date(year, m + 1, 0)
      buckets.push({
        label: cap(SHORT_MONTHS_ES[m]),
        start: fmtDateOnly(monthStart),
        end: fmtDateOnly(monthEnd),
        income: 0,
        expenses: 0,
        net: 0,
      })
    }
  }

  // Asignar movs a buckets
  for (const m of movs) {
    const bucket = buckets.find(b => m.movement_date >= b.start && m.movement_date <= b.end)
    if (!bucket) continue
    if (m.type === 'ingreso') bucket.income += m.amount
    else if (m.type === 'gasto') bucket.expenses += m.amount
  }

  // Computar net por bucket
  for (const b of buckets) {
    b.net = b.income - b.expenses
  }

  return buckets
}

function fmtDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(d: Date): string {
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  // getDay: 0=Dom, 1=Lun ...
  const dow = d.getDay()
  const idx = dow === 0 ? 6 : dow - 1
  return days[idx]
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
