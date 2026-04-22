import { createClient } from '@/lib/supabase/server'

const WEEKDAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

function getMondayStr(d: Date): string {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  return copy.toISOString().slice(0, 10)
}

function offsetWeek(mondayStr: string, weeks: number): string {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const start90 = ninetyDaysAgo.toISOString().slice(0, 10)

  const { data: rows } = await supabase
    .from('movements')
    .select('type, amount, movement_date, is_investment')
    .gte('movement_date', start90)
    .order('movement_date', { ascending: true })

  if (!rows || rows.length === 0) {
    return Response.json({
      insight: 'Sigue registrando — en unos días Fiza podrá decirte cosas interesantes sobre tu negocio.',
      type: 'motivational',
    })
  }

  // ── Contar días activos ──────────────────────────────────────
  const activeDays = new Set(rows.map(r => r['movement_date'] as string))
  const daysActive = activeDays.size

  if (daysActive < 21) {
    const messages = [
      `Ya van ${daysActive} día${daysActive !== 1 ? 's' : ''} registrando. Con un poco más, Fiza empieza a entender tus patrones.`,
      'Sigue registrando — en unos días Fiza podrá decirte cosas interesantes sobre tu negocio.',
      'Cada registro cuenta. Pronto podrás ver cosas que no sabías de tu negocio.',
    ]
    return Response.json({ insight: messages[daysActive % messages.length], type: 'motivational' })
  }

  // ── Agrupar por fecha ────────────────────────────────────────
  type DaySummary = { income: number; expenses: number }
  const byDate: Record<string, DaySummary> = {}

  for (const r of rows) {
    const d = r['movement_date'] as string
    if (!byDate[d]) byDate[d] = { income: 0, expenses: 0 }
    if (r['is_investment'] as boolean) continue
    if (r['type'] === 'ingreso') byDate[d].income += Number(r['amount'])
    else if (r['type'] === 'gasto') byDate[d].expenses += Number(r['amount'])
  }

  const allDates = Object.keys(byDate).sort()

  // ── 1. Hoy vs promedio diario ────────────────────────────────
  if (daysActive >= 10) {
    const todayData = byDate[today]
    const pastDates = allDates.filter(d => d < today)

    if (pastDates.length >= 10) {
      const last30past = pastDates.slice(-30)
      const avgIncome = last30past.reduce((s, d) => s + byDate[d].income, 0) / last30past.length

      if (!todayData) {
        const hour = new Date().getHours()
        if (hour >= 13) {
          return Response.json({ insight: 'Llevas el día sin registrar movimientos.', type: 'empty_today' })
        }
      } else {
        const diff = avgIncome > 0 ? (todayData.income - avgIncome) / avgIncome * 100 : 0
        const pct = Math.abs(Math.round(diff))
        if (pct > 5) {
          const dir = diff >= 0 ? 'por encima' : 'por debajo'
          return Response.json({
            insight: `Hoy llevas ${fmt(todayData.income)} en ingresos — ${pct}% ${dir} de tu promedio diario (${fmt(avgIncome)}).`,
            type: 'today_vs_avg',
          })
        } else if (todayData.income > 0) {
          return Response.json({
            insight: `Hoy llevas ${fmt(todayData.income)} en ingresos — justo en tu promedio diario (${fmt(avgIncome)}).`,
            type: 'today_vs_avg',
          })
        }
      }
    }
  }

  // ── 2. Esta semana vs semana anterior ────────────────────────
  const thisMonday = getMondayStr(new Date())
  const lastMonday = offsetWeek(thisMonday, -1)
  const lastSunday = new Date(new Date(thisMonday).getTime() - 86400000).toISOString().slice(0, 10)

  const thisWeekIncome = allDates
    .filter(d => d >= thisMonday && d <= today)
    .reduce((s, d) => s + byDate[d].income, 0)

  const lastWeekIncome = allDates
    .filter(d => d >= lastMonday && d <= lastSunday)
    .reduce((s, d) => s + byDate[d].income, 0)

  if (lastWeekIncome > 0) {
    const diff = thisWeekIncome - lastWeekIncome
    const pct = Math.round(Math.abs(diff / lastWeekIncome * 100))
    const dir = diff >= 0 ? 'más' : 'menos'
    return Response.json({
      insight: `Esta semana llevas ${fmt(thisWeekIncome)} en ingresos — ${pct}% ${dir} que la semana pasada (${fmt(lastWeekIncome)}).`,
      type: 'week_vs_week',
    })
  }

  // ── 3. Mejor día de la semana ────────────────────────────────
  const wdTotals: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const d of allDates) {
    const [y, mo, day] = d.split('-').map(Number)
    const wd = (new Date(y, mo - 1, day).getDay() + 6) % 7 // 0=lun
    wdTotals[wd].push(byDate[d].income)
  }

  const wdAvgs = Object.entries(wdTotals)
    .filter(([, arr]) => arr.length >= 3)
    .map(([wd, arr]) => ({ wd: Number(wd), avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => b.avg - a.avg)

  if (wdAvgs.length > 0 && wdAvgs[0].avg > 0) {
    const best = wdAvgs[0]
    return Response.json({
      insight: `Los ${WEEKDAYS_ES[best.wd]} son tu mejor día en promedio — ${fmt(best.avg)} en ingresos.`,
      type: 'best_weekday',
    })
  }

  // ── 4. Tendencia de gastos ───────────────────────────────────
  const thisWeekExpenses = allDates
    .filter(d => d >= thisMonday && d <= today)
    .reduce((s, d) => s + byDate[d].expenses, 0)

  const weeklyExps: number[] = []
  for (let i = 1; i <= 4; i++) {
    const wStart = offsetWeek(thisMonday, -i)
    const wEnd = offsetWeek(thisMonday, -i + 1)
    const wEndActual = new Date(new Date(wEnd).getTime() - 86400000).toISOString().slice(0, 10)
    const total = allDates
      .filter(d => d >= wStart && d <= wEndActual)
      .reduce((s, d) => s + byDate[d].expenses, 0)
    if (total > 0) weeklyExps.push(total)
  }

  if (weeklyExps.length >= 2 && thisWeekExpenses > 0) {
    const avg = weeklyExps.reduce((a, b) => a + b, 0) / weeklyExps.length
    const pct = Math.round(Math.abs((thisWeekExpenses - avg) / avg * 100))
    if (pct > 10) {
      const dir = thisWeekExpenses > avg ? 'por encima' : 'por debajo'
      return Response.json({
        insight: `Tus gastos esta semana (${fmt(thisWeekExpenses)}) están ${pct}% ${dir} de tu promedio semanal (${fmt(avg)}).`,
        type: 'expense_trend',
      })
    }
  }

  // ── 5. Días sin registrar ────────────────────────────────────
  const lastDate = allDates[allDates.length - 1]
  if (lastDate && lastDate < today) {
    const [ly, lm, ld] = lastDate.split('-').map(Number)
    const diffMs = new Date().getTime() - new Date(ly, lm - 1, ld).getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays >= 2) {
      return Response.json({
        insight: `Llevan ${diffDays} días sin registrar — ¿todo bien?`,
        type: 'inactive',
      })
    }
  }

  // ── Fallback ─────────────────────────────────────────────────
  const totalIncome = allDates.slice(-30).reduce((s, d) => s + byDate[d].income, 0)
  return Response.json({
    insight: `En los últimos 30 días llevas ${fmt(totalIncome)} en ingresos registrados.`,
    type: 'summary',
  })
}
