/**
 * app/api/reports/trend/route.ts
 *
 * Devuelve buckets agregados de ingresos / gastos / neto para la vista
 * "Tendencia" de /reportes. Buckets por mes o por semana.
 *
 *   GET ?granularity=month  → últimos N meses (Free: 3, Pro: 12)
 *   GET ?granularity=week   → últimas 12 semanas (Pro only)
 *
 * Free: solo granularity=month, count=3 (consistente con reportes/cap).
 * Pro:  granularity=month → 12 meses, granularity=week → 12 semanas.
 *
 * Inversiones excluidas siempre (consistente con la vista "Este período").
 * Pendientes filtradas a SQL.
 */

import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/constants'
import type { Movement } from '@/types'

type Granularity = 'month' | 'week'

interface Bucket {
  label: string
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  income: number
  expenses: number
  net: number
}

const SHORT_MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + offset)
  m.setHours(0, 0, 0, 0)
  return m
}

function buildMonthBuckets(count: number, today: Date): Bucket[] {
  const buckets: Bucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    buckets.push({
      label: `${SHORT_MONTHS_ES[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
      start: fmtYMD(start),
      end: fmtYMD(end),
      income: 0,
      expenses: 0,
      net: 0,
    })
  }
  return buckets
}

function buildWeekBuckets(count: number, today: Date): Bucket[] {
  const thisMonday = startOfWeek(today)
  const buckets: Bucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setDate(thisMonday.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    buckets.push({
      label: `${start.getDate()} ${SHORT_MONTHS_ES[start.getMonth()]}`.toLowerCase(),
      start: fmtYMD(start),
      end: fmtYMD(end),
      income: 0,
      expenses: 0,
      net: 0,
    })
  }
  return buckets
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

  const { searchParams } = new URL(request.url)
  const granRaw = searchParams.get('granularity') ?? 'month'
  if (granRaw !== 'month' && granRaw !== 'week') {
    return Response.json({ error: 'granularity inválido (month|week)' }, { status: 400 })
  }
  const granularity = granRaw as Granularity

  // Free: solo monthly, 3 buckets
  if (plan === 'free' && granularity !== 'month') {
    return Response.json(
      { error: 'Granularidad semanal requiere plan Pro', code: 'PRO_REQUIRED' },
      { status: 403 }
    )
  }

  const today = new Date()
  const count = plan === 'free'
    ? PLANS.FREE.historyMonths              // 3
    : (granularity === 'month' ? 12 : 12)   // Pro: 12 meses o 12 semanas

  const buckets = granularity === 'month'
    ? buildMonthBuckets(count, today)
    : buildWeekBuckets(count, today)

  // Una sola query cubre el rango completo
  const queryStart = buckets[0].start
  const queryEnd = buckets[buckets.length - 1].end

  const { data, error } = await supabase
    .from('movements')
    .select('type, amount, movement_date, is_investment')
    .gte('movement_date', queryStart)
    .lte('movement_date', queryEnd)
    .eq('user_id', user.id)
    .in('type', ['ingreso', 'gasto'])

  if (error) {
    console.error('[GET /api/reports/trend]', error)
    return Response.json({ error: 'Error al cargar tendencia' }, { status: 500 })
  }

  // Asigna cada movimiento a su bucket. Construimos un índice por start->bucket
  // para asignación O(1) en monthly; para weekly hacemos linear scan (12 buckets max).
  const movs = (data ?? []) as Array<{
    type: Movement['type']
    amount: number
    movement_date: string
    is_investment: boolean
  }>

  for (const m of movs) {
    if (m.is_investment) continue
    // Encuentra el bucket: primer bucket donde start <= movement_date <= end
    const bucket = buckets.find(b => m.movement_date >= b.start && m.movement_date <= b.end)
    if (!bucket) continue
    const amount = Number(m.amount)
    if (m.type === 'ingreso') bucket.income += amount
    else if (m.type === 'gasto') bucket.expenses += amount
  }

  for (const b of buckets) {
    b.net = b.income - b.expenses
  }

  return Response.json({ granularity, buckets })
}
