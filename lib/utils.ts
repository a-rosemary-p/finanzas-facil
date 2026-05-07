import type { DashboardMetrics, DateFilter, Movement } from '@/types'

// Calcula ingresos / gastos / neto de un conjunto de movimientos.
// Respeta el flag showInvestments (excluye is_investment cuando es false).
export function calcMetrics(
  rows: { type: string; amount: number; isInvestment: boolean }[],
  showInvestments: boolean
): DashboardMetrics {
  let income = 0, expenses = 0
  for (const r of rows) {
    if (!showInvestments && r.isInvestment) continue
    if (r.type === 'ingreso') income += r.amount
    else if (r.type === 'gasto') expenses += r.amount
  }
  return { income, expenses, net: income - expenses }
}

// Formatea un número como moneda MXN: $1,500 / $1,500.50
export function formatCurrency(amount: number): string {
  return (
    '$' +
    Math.abs(amount).toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  )
}

// Devuelve la fecha de hoy en YYYY-MM-DD usando timezone local
export function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Formatea YYYY-MM-DD → "17 de abril de 2026" (timezone-safe, siempre en español)
export function formatEntryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toLowerCase()
}

// Formatea YYYY-MM-DD → "Domingo, 19 de abril 2026" con día de la semana
export function formatDateWithWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  const raw = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // Capitalizar primera letra
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// Devuelve la etiqueta de período para el header de métricas
export function getPeriodLabel(
  filter: DateFilter,
  selectedMonth?: Date,
  customRange?: { from: string; to: string }
): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  switch (filter) {
    case 'today': {
      const raw = now.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      return raw.charAt(0).toUpperCase() + raw.slice(1)
    }
    case '7days': {
      const from = new Date(now)
      from.setDate(now.getDate() - 6)
      const fromStr = `${pad(from.getDate())}/${pad(from.getMonth() + 1)}/${from.getFullYear()}`
      const toStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`
      return `${fromStr} – ${toStr}`
    }
    case 'month': {
      const target = selectedMonth ?? now
      const raw = target.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      return raw.charAt(0).toUpperCase() + raw.slice(1)
    }
    case 'year':
      return String(now.getFullYear())
    case 'all':
      return 'Todo el historial'
    case 'custom': {
      if (customRange) {
        // "01/04/26 – 15/04/26"
        const fmt = (s: string) => {
          const [y, m, d] = s.split('-').map(Number)
          return `${pad(d ?? 1)}/${pad(m ?? 1)}/${String(y ?? now.getFullYear()).slice(2)}`
        }
        return `${fmt(customRange.from)} – ${fmt(customRange.to)}`
      }
      return 'Rango'
    }
    default:
      return ''
  }
}

// Devuelve el rango de fechas { start, end } para un filtro dado.
// maxHistoryDays: si se pasa, la fecha de inicio nunca será mayor a N días atrás (plan Free = 30).
// customRange: requerido cuando filter === 'custom'.
export function getDateRange(
  filter: DateFilter,
  selectedMonth?: Date,
  maxHistoryDays?: number,
  customRange?: { from: string; to: string }
): { start: string; end: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const end = fmt(today)

  let range: { start: string; end: string }

  switch (filter) {
    case 'today':
      range = { start: end, end }; break
    case '7days': {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      range = { start: fmt(start), end }; break
    }
    case 'month': {
      // v0.3: rolling 30 días en lugar de mes calendario.
      // Razón: el copy de marketing dice "30 días de historial" y los users
      // esperaban ver 30 días. Antes (calendario) si era 7 mayo, "Mes" mostraba
      // 7 días y confundía. Ahora "Mes" = [hoy - 29, hoy], consistente con
      // /inicio MetricsCard y con el copy. Si el caller pasa selectedMonth
      // específico, respetamos calendario para back-compat de cualquier flow
      // legacy (hoy ningún caller activo lo hace).
      if (selectedMonth) {
        const y = selectedMonth.getFullYear()
        const mo = selectedMonth.getMonth()
        const lastDay = new Date(y, mo + 1, 0)
        range = { start: `${y}-${pad(mo + 1)}-01`, end: fmt(lastDay) }
      } else {
        const start = new Date(today)
        start.setDate(today.getDate() - 29)
        range = { start: fmt(start), end }
      }
      break
    }
    case 'year':
      range = { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` }; break
    case 'custom':
      range = customRange
        ? { start: customRange.from, end: customRange.to }
        : { start: '2000-01-01', end: '2099-12-31' }
      break
    case 'all':
    default:
      range = { start: '2000-01-01', end: '2099-12-31' }
  }

  // Aplicar límite de historial (plan Free = 30 días)
  if (maxHistoryDays !== undefined) {
    const cap = new Date(today)
    cap.setDate(today.getDate() - (maxHistoryDays - 1))
    const capStr = fmt(cap)
    if (range.start < capStr) range = { ...range, start: capStr }
  }

  return range
}

// Formatea un rango YYYY-MM-DD → texto humano corto en español.
//   - Mismo día                  → "7 may"
//   - Mismo mes (rango)          → "1 — 7 may"
//   - Distinto mes (mismo año)   → "8 abr — 7 may"
//   - Distintos años             → "8 abr 2025 — 7 may 2026"
// Pensado para mostrar bajo el toggle de fechas en /movimientos.
export function formatRangeShort(start: string, end: string): string {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return { y, m: m - 1, d }
  }
  const s = parse(start)
  const e = parse(end)
  const fmtDay = (p: { d: number }) => String(p.d)
  const fmtDayMon = (p: { m: number; d: number }) => `${p.d} ${meses[p.m]}`
  const fmtFull = (p: { y: number; m: number; d: number }) => `${p.d} ${meses[p.m]} ${p.y}`

  if (start === end) return fmtDayMon(s)
  if (s.y !== e.y) return `${fmtFull(s)} — ${fmtFull(e)}`
  if (s.m === e.m) return `${fmtDay(s)} — ${fmtDayMon(e)}`
  return `${fmtDayMon(s)} — ${fmtDayMon(e)}`
}

// Agrupa movimientos por movement_date → { 'YYYY-MM-DD': Movement[] }
export function groupMovementsByDate(movements: Movement[]): Record<string, Movement[]> {
  const grouped: Record<string, Movement[]> = {}
  for (const m of movements) {
    const key = m.movementDate
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }
  return grouped
}
