import type { DateFilter, Movement } from '@/types'

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
export function getPeriodLabel(filter: DateFilter, selectedMonth?: Date): string {
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
    case 'custom':
      return 'Rango personalizado'
    default:
      return ''
  }
}

// Devuelve el rango de fechas { start, end } para un filtro dado
export function getDateRange(
  filter: DateFilter,
  selectedMonth?: Date
): { start: string; end: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const end = fmt(today)

  switch (filter) {
    case 'today':
      return { start: end, end }
    case '7days': {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      return { start: fmt(start), end }
    }
    case 'month': {
      const target = selectedMonth ?? today
      const y = target.getFullYear()
      const mo = target.getMonth()
      const lastDay = new Date(y, mo + 1, 0)
      return {
        start: `${y}-${pad(mo + 1)}-01`,
        end: fmt(lastDay),
      }
    }
    case 'year':
      return {
        start: `${today.getFullYear()}-01-01`,
        end: `${today.getFullYear()}-12-31`,
      }
    case 'all':
    case 'custom':
      return { start: '2000-01-01', end: '2099-12-31' }
  }
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
