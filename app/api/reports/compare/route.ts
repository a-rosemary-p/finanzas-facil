/**
 * app/api/reports/compare/route.ts
 *
 * Devuelve agregados de período actual + período anterior equivalente para
 * el card de métricas en /inicio y la vista "¿Cómo voy?" en /reportes.
 *
 * Periodos soportados (todos rolling — basados en hoy, no en calendario):
 *   today  → hoy (1 día) vs promedio diario de los últimos 30 días previos
 *   week   → últimos 7 días vs los 7 días previos
 *   month  → últimos 30 días vs los 30 días previos
 *   year   → últimos 365 días vs los 365 días previos
 *   global → historial completo del usuario, SIN comparación (previous=null)
 *
 * Por qué rolling y no calendario: un user no ve un "reset" raro el día 1 de
 * cada mes. La lectura "últimos 30 días" es estable y siempre comparable.
 *
 * Inversiones se EXCLUYEN siempre del agregado.
 * Pendientes ya filtrados por la consulta (in('type', ['ingreso','gasto'])).
 *
 * Nota: /reportes usa este mismo endpoint con week|month|year. Los datos
 * cambian (de calendario a rolling) pero el shape del response es el mismo
 * salvo por `previous` que ahora puede ser null cuando period=global.
 */

import { createClient } from '@/lib/supabase/server'
import { getAppToday } from '@/lib/cdmx-date'
import type { Movement, Category } from '@/types'

type ComparePeriod = 'global' | 'year' | 'month' | 'week' | 'today'

// Para period=today: ventana del baseline "promedio diario" anterior.
const TODAY_BASELINE_DAYS = 30

// Largo (en días) de la ventana rolling para cada período no-global.
const ROLLING_DAYS: Record<Exclude<ComparePeriod, 'global'>, number> = {
  today: 1,
  week:  7,
  month: 30,
  year:  365,
}

interface ByCategory {
  [cat: string]: { income: number; expenses: number }
}

interface Aggregate {
  range: { start: string; end: string }
  income: number
  expenses: number
  net: number
  byCategory: ByCategory
}

interface SparkSeries {
  income: number[]
  expenses: number[]
  net: number[]
}

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parsea YYYY-MM-DD a Date local (00:00). Evita drift de TZ del browser. */
function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(d.getDate() + n)
  return out
}

interface RangePair {
  current:  { start: Date; end: Date }
  /** null cuando period=global — no hay "antes" de toda la historia. */
  previous: { start: Date; end: Date } | null
}

function computeRollingRanges(
  period: Exclude<ComparePeriod, 'global'>,
  todayMidnight: Date,
): RangePair {
  if (period === 'today') {
    // current = hoy. previous = los 30 días COMPLETOS anteriores (excluye hoy).
    // El cliente compara hoy contra (sum / 30) — ver scaleAggregate abajo.
    const previousEnd   = addDays(todayMidnight, -1)
    const previousStart = addDays(todayMidnight, -TODAY_BASELINE_DAYS)
    return {
      current:  { start: todayMidnight, end: todayMidnight },
      previous: { start: previousStart, end: previousEnd },
    }
  }
  // week|month|year — current = últimos N días incluyendo hoy.
  // previous = los N días previos (sin overlap con current).
  const n = ROLLING_DAYS[period]
  const currentStart  = addDays(todayMidnight, -(n - 1))
  const previousEnd   = addDays(currentStart, -1)
  const previousStart = addDays(previousEnd, -(n - 1))
  return {
    current:  { start: currentStart,  end: todayMidnight },
    previous: { start: previousStart, end: previousEnd  },
  }
}

function aggregateMovements(movs: Movement[], range: { start: Date; end: Date }): Aggregate {
  let income = 0
  let expenses = 0
  const byCategory: ByCategory = {}

  for (const m of movs) {
    if (m.isInvestment) continue
    const cat = m.category
    if (!byCategory[cat]) byCategory[cat] = { income: 0, expenses: 0 }
    if (m.type === 'ingreso') {
      income += m.amount
      byCategory[cat].income += m.amount
    } else if (m.type === 'gasto') {
      expenses += m.amount
      byCategory[cat].expenses += m.amount
    }
  }

  return {
    range: { start: fmtYMD(range.start), end: fmtYMD(range.end) },
    income,
    expenses,
    net: income - expenses,
    byCategory,
  }
}

function emptyAggregate(start: Date, end: Date): Aggregate {
  return {
    range: { start: fmtYMD(start), end: fmtYMD(end) },
    income: 0,
    expenses: 0,
    net: 0,
    byCategory: {},
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const periodRaw = searchParams.get('period') ?? 'global'
  const validPeriods: ComparePeriod[] = ['global', 'year', 'month', 'week', 'today']
  if (!validPeriods.includes(periodRaw as ComparePeriod)) {
    return Response.json({ error: 'period inválido' }, { status: 400 })
  }
  const period = periodRaw as ComparePeriod

  // "Hoy" CDMX consistente con el resto de la app.
  const todayMidnight = parseYMD(getAppToday())

  // ─── Rangos ────────────────────────────────────────────────────────────
  let currentRange:  { start: Date; end: Date }
  let previousRange: { start: Date; end: Date } | null

  if (period === 'global') {
    // Necesitamos el primer movement_date del usuario para acotar la consulta
    // y los buckets del sparkline.
    const { data: firstRow } = await supabase
      .from('movements')
      .select('movement_date')
      .eq('user_id', user.id)
      .in('type', ['ingreso', 'gasto'])
      .order('movement_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    const firstDate = (firstRow?.movement_date as string | undefined)
      ? parseYMD(firstRow!.movement_date as string)
      : todayMidnight

    currentRange  = { start: firstDate, end: todayMidnight }
    previousRange = null
  } else {
    const ranges  = computeRollingRanges(period, todayMidnight)
    currentRange  = ranges.current
    previousRange = ranges.previous
  }

  // ─── Query única que cubre ambos rangos ────────────────────────────────
  const queryStart = fmtYMD(previousRange?.start ?? currentRange.start)
  const queryEnd   = fmtYMD(currentRange.end)

  const { data, error } = await supabase
    .from('movements')
    .select('id, type, amount, description, category, movement_date, is_investment')
    .gte('movement_date', queryStart)
    .lte('movement_date', queryEnd)
    .eq('user_id', user.id)
    .in('type', ['ingreso', 'gasto'])

  if (error) {
    console.error('[GET /api/reports/compare]', error)
    return Response.json({ error: 'Error al cargar datos' }, { status: 500 })
  }

  const allMovements: Movement[] = (data ?? []).map(r => ({
    id: r.id as string,
    type: r.type as Movement['type'],
    amount: Number(r.amount),
    description: r.description as string,
    category: r.category as Category,
    movementDate: r.movement_date as string,
    isInvestment: (r.is_investment as boolean) ?? false,
  }))

  // ─── Particionar por rango ─────────────────────────────────────────────
  const currentStartStr = fmtYMD(currentRange.start)
  const currentMovs = allMovements.filter(m => m.movementDate >= currentStartStr)
  const current = aggregateMovements(currentMovs, currentRange)

  let previous: Aggregate | null = null
  if (previousRange) {
    const previousEndStr = fmtYMD(previousRange.end)
    const previousMovs = allMovements.filter(m => m.movementDate <= previousEndStr)
    previous = aggregateMovements(previousMovs, previousRange)

    // period=today: el "previous" cubre 30 días, normalizamos para comparar
    // hoy contra "lo normal" en un día.
    if (period === 'today') {
      previous = scaleAggregate(previous, 1 / TODAY_BASELINE_DAYS)
    }
  }

  // Sparkline: solo sobre movimientos del rango actual (no del previous).
  const sparkline = computeSparkline(period, currentMovs, currentRange, todayMidnight)

  return Response.json({
    period,
    current,
    previous,
    sparkline,
  })
}

// ─── Sparkline buckets ───────────────────────────────────────────────────────

interface Bucket { start: string; end: string }

function bucketRanges(
  period: ComparePeriod,
  currentRange: { start: Date; end: Date },
  todayMidnight: Date,
): Bucket[] {
  switch (period) {
    case 'today': {
      // Para 'today' (1 día) el sparkline pierde sentido si fuera 1 punto;
      // mantenemos 7 buckets diarios terminando hoy para dar contexto.
      const buckets: Bucket[] = []
      for (let i = 6; i >= 0; i--) {
        const d = addDays(todayMidnight, -i)
        const s = fmtYMD(d)
        buckets.push({ start: s, end: s })
      }
      return buckets
    }
    case 'week': {
      // 7 buckets diarios terminando hoy (rolling, no lunes-domingo).
      const buckets: Bucket[] = []
      for (let i = 6; i >= 0; i--) {
        const d = addDays(todayMidnight, -i)
        const s = fmtYMD(d)
        buckets.push({ start: s, end: s })
      }
      return buckets
    }
    case 'month': {
      // 30 buckets diarios terminando hoy.
      const buckets: Bucket[] = []
      for (let i = 29; i >= 0; i--) {
        const d = addDays(todayMidnight, -i)
        const s = fmtYMD(d)
        buckets.push({ start: s, end: s })
      }
      return buckets
    }
    case 'year': {
      // 12 buckets mensuales terminando con el mes de hoy.
      const buckets: Bucket[] = []
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() - i, 1)
        const monthEnd   = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() - i + 1, 0)
        buckets.push({ start: fmtYMD(monthStart), end: fmtYMD(monthEnd) })
      }
      return buckets
    }
    case 'global': {
      // Buckets mensuales desde el mes del primer movimiento al mes actual.
      // Si excede 36 meses, agrupamos los más viejos en el primer bucket
      // (cap visual — sparkline con 50+ puntos se vuelve ilegible).
      const start = currentRange.start
      const end   = todayMidnight
      const buckets: Bucket[] = []
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cursor <= end) {
        const mStart = new Date(cursor)
        const mEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
        buckets.push({ start: fmtYMD(mStart), end: fmtYMD(mEnd) })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      // Cap a 36 — los más viejos se mergean.
      const MAX = 36
      if (buckets.length > MAX) {
        const overflow = buckets.length - MAX
        const firstNew: Bucket = {
          start: buckets[0].start,
          end:   buckets[overflow].end,
        }
        return [firstNew, ...buckets.slice(overflow + 1)]
      }
      return buckets
    }
  }
}

function computeSparkline(
  period: ComparePeriod,
  movs: Movement[],
  currentRange: { start: Date; end: Date },
  todayMidnight: Date,
): SparkSeries {
  const buckets = bucketRanges(period, currentRange, todayMidnight)
  const income   = new Array(buckets.length).fill(0) as number[]
  const expenses = new Array(buckets.length).fill(0) as number[]

  for (const m of movs) {
    if (m.isInvestment) continue
    if (m.type !== 'ingreso' && m.type !== 'gasto') continue
    const idx = buckets.findIndex(b => m.movementDate >= b.start && m.movementDate <= b.end)
    if (idx === -1) continue
    if (m.type === 'ingreso') income[idx] += m.amount
    else expenses[idx] += m.amount
  }

  const net = income.map((v, i) => v - expenses[i])
  return { income, expenses, net }
}

function scaleAggregate(agg: Aggregate, factor: number): Aggregate {
  const byCategory: ByCategory = {}
  for (const [cat, v] of Object.entries(agg.byCategory)) {
    byCategory[cat] = { income: v.income * factor, expenses: v.expenses * factor }
  }
  return {
    range: agg.range,
    income: agg.income * factor,
    expenses: agg.expenses * factor,
    net: agg.net * factor,
    byCategory,
  }
}
