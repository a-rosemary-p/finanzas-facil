/**
 * app/api/reports/compare/route.ts
 *
 * Devuelve dos agregados — período actual hasta hoy + período equivalente
 * anterior — para sparkline+delta del card de métricas en `/registros` y
 * para la vista "¿Cómo voy?" del /reportes.
 *
 * Comparación "justa": si hoy es 10 de abril, current = Apr 1–10 (10 días),
 * previous = Mar 1–10 (10 días). Si el período anterior es más corto que el
 * offset (ej. today=Mar 31 vs Feb), el rango previous se capa al último día
 * del período anterior — leve desbalance pero pragmático.
 *
 * Para `period=today` no existe un "ayer equivalente" estable (un solo día es
 * muy ruidoso) — comparamos contra el **promedio diario de los últimos 30
 * días** (excluyendo hoy). El response usa la misma forma `previous` para que
 * el cliente compute %Δ igual que con week/month/year.
 *
 * Free + Pro pueden llamar este endpoint (la diferenciación Pro vive en la
 * vista — la "¿Cómo voy?" en /reportes tiene UI bloqueada para Free, breakdown
 * por categoría con frase natural, etc.). El sparkline+delta básico es valor
 * universal — un %Δ no diferencia tier por sí solo.
 *
 * Inversiones se EXCLUYEN siempre del agregado (la vista no las tiene en cuenta).
 * Pendientes ya no llegan acá vía la consulta (in('type', ['ingreso','gasto'])).
 */

import { createClient } from '@/lib/supabase/server'
import type { Movement, Category } from '@/types'

type ComparePeriod = 'today' | 'week' | 'month' | 'year'

// Ventana del fallback "promedio diario" cuando period=today.
const TODAY_BASELINE_DAYS = 30

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

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ...
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + offset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function dayDiff(a: Date, b: Date): number {
  // Number of days between two dates (b - a), ignoring DST/time
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function lastDayOfMonth(year: number, monthIdx: number): Date {
  return new Date(year, monthIdx + 1, 0)
}

interface RangePair {
  current: { start: Date; end: Date }
  previous: { start: Date; end: Date }
}

function computeRanges(period: ComparePeriod, today: Date): RangePair {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  switch (period) {
    case 'today': {
      // current = hoy (1 día). previous = los últimos 30 días COMPLETOS antes
      // de hoy. El cliente compara hoy contra (sum_30d / 30) — ver el divisor
      // en GET handler. Excluimos hoy del baseline porque queremos comparar
      // hoy contra "lo normal", no contra "lo normal incluyéndome".
      const previousEnd = new Date(todayMidnight)
      previousEnd.setDate(todayMidnight.getDate() - 1)
      const previousStart = new Date(todayMidnight)
      previousStart.setDate(todayMidnight.getDate() - TODAY_BASELINE_DAYS)
      return {
        current: { start: todayMidnight, end: todayMidnight },
        previous: { start: previousStart, end: previousEnd },
      }
    }

    case 'week': {
      const currentStart = startOfWeek(todayMidnight)
      const previousStart = new Date(currentStart)
      previousStart.setDate(currentStart.getDate() - 7)
      const offset = dayDiff(currentStart, todayMidnight)
      const previousEnd = new Date(previousStart)
      previousEnd.setDate(previousStart.getDate() + offset)
      return {
        current: { start: currentStart, end: todayMidnight },
        previous: { start: previousStart, end: previousEnd },
      }
    }

    case 'month': {
      const currentStart = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), 1)
      const previousStart = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() - 1, 1)
      const offset = dayDiff(currentStart, todayMidnight)
      let previousEnd = new Date(previousStart)
      previousEnd.setDate(previousStart.getDate() + offset)
      // Cap si el previous month tiene menos días que today's day-of-month
      const prevLast = lastDayOfMonth(previousStart.getFullYear(), previousStart.getMonth())
      if (previousEnd > prevLast) previousEnd = prevLast
      return {
        current: { start: currentStart, end: todayMidnight },
        previous: { start: previousStart, end: previousEnd },
      }
    }

    case 'year': {
      const currentStart = new Date(todayMidnight.getFullYear(), 0, 1)
      const previousStart = new Date(todayMidnight.getFullYear() - 1, 0, 1)
      const offset = dayDiff(currentStart, todayMidnight)
      let previousEnd = new Date(previousStart)
      previousEnd.setDate(previousStart.getDate() + offset)
      // Cap por edge case Feb 29 en año bisiesto vs no bisiesto
      const prevYearLast = new Date(previousStart.getFullYear(), 11, 31)
      if (previousEnd > prevYearLast) previousEnd = prevYearLast
      return {
        current: { start: currentStart, end: todayMidnight },
        previous: { start: previousStart, end: previousEnd },
      }
    }
  }
}

function aggregateMovements(movs: Movement[], range: { start: Date; end: Date }): Aggregate {
  let income = 0
  let expenses = 0
  const byCategory: ByCategory = {}

  for (const m of movs) {
    if (m.isInvestment) continue // Inversiones NO cuentan en la comparación
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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  // Plan ya no se gata aquí — abierto a Free + Pro. La diferenciación de
  // valor entre tiers se hace en la UI ("¿Cómo voy?" tiene preview difuminado
  // para Free), no en este endpoint.

  const { searchParams } = new URL(request.url)
  const periodRaw = searchParams.get('period') ?? 'month'
  if (periodRaw !== 'today' && periodRaw !== 'week' && periodRaw !== 'month' && periodRaw !== 'year') {
    return Response.json({ error: 'period inválido (today|week|month|year)' }, { status: 400 })
  }
  const period = periodRaw as ComparePeriod

  const ranges = computeRanges(period, new Date())

  // Una sola query que cubre AMBOS rangos (continúo desde previousStart hasta
  // currentEnd para minimizar viajes). Después separo en memoria.
  const queryStart = fmtYMD(ranges.previous.start)
  const queryEnd = fmtYMD(ranges.current.end)

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

  // Particiona por rango — los rangos no se traslapan (previous siempre acaba
  // antes que current empiece) así que un movimiento cae en uno o ninguno.
  const currentStartStr  = fmtYMD(ranges.current.start)
  const previousEndStr   = fmtYMD(ranges.previous.end)

  const currentMovs = allMovements.filter(m => m.movementDate >= currentStartStr)
  const previousMovs = allMovements.filter(m => m.movementDate <= previousEndStr)

  const current = aggregateMovements(currentMovs, ranges.current)
  let previous = aggregateMovements(previousMovs, ranges.previous)

  // period=today: el "previous" cubre 30 días, así que normalizamos dividiendo
  // entre 30 para que el cliente pueda hacer (current - previous)/previous y
  // tenga la lectura "hoy vs lo que normalmente pasa en un día". Sin esto,
  // siempre se vería como caída del -97% (1 día vs 30 días).
  if (period === 'today') {
    previous = scaleAggregate(previous, 1 / TODAY_BASELINE_DAYS)
  }

  return Response.json({
    period,
    current,
    previous,
  })
}

function scaleAggregate(agg: Aggregate, factor: number): Aggregate {
  const byCategory: ByCategory = {}
  for (const [cat, v] of Object.entries(agg.byCategory)) {
    byCategory[cat] = { income: v.income * factor, expenses: v.expenses * factor }
  }
  return {
    range: agg.range, // el rango sigue siendo el de los 30d, no la "media"
    income: agg.income * factor,
    expenses: agg.expenses * factor,
    net: agg.net * factor,
    byCategory,
  }
}
