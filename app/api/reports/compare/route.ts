/**
 * app/api/reports/compare/route.ts
 *
 * Devuelve dos agregados — período actual hasta hoy + período equivalente
 * anterior — para la vista "¿Cómo voy?" del /reportes.
 *
 * Comparación "justa": si hoy es 10 de abril, current = Apr 1–10 (10 días),
 * previous = Mar 1–10 (10 días). Si el período anterior es más corto que el
 * offset (ej. today=Mar 31 vs Feb), el rango previous se capa al último día
 * del período anterior — leve desbalance pero pragmático.
 *
 * Solo Pro. Free recibe 403 PRO_REQUIRED.
 *
 * Inversiones se EXCLUYEN siempre del agregado (la vista no las tiene en cuenta).
 * Pendientes ya no llegan acá vía la consulta (in('type', ['ingreso','gasto'])).
 */

import { createClient } from '@/lib/supabase/server'
import type { Movement, Category } from '@/types'

type ComparePeriod = 'week' | 'month' | 'year'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free') as 'free' | 'pro'

  if (plan === 'free') {
    return Response.json(
      { error: 'La vista "¿Cómo voy?" es función Pro', code: 'PRO_REQUIRED' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const periodRaw = searchParams.get('period') ?? 'month'
  if (periodRaw !== 'week' && periodRaw !== 'month' && periodRaw !== 'year') {
    return Response.json({ error: 'period inválido (week|month|year)' }, { status: 400 })
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

  return Response.json({
    period,
    current: aggregateMovements(currentMovs, ranges.current),
    previous: aggregateMovements(previousMovs, ranges.previous),
  })
}
