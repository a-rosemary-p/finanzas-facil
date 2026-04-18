import type { DateFilter } from '@/types'

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

// Formatea YYYY-MM-DD → "sáb. 17 abr." (timezone-safe)
export function formatEntryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Devuelve el rango de fechas { start, end } para un filtro dado
export function getDateRange(filter: DateFilter): { start: string; end: string } {
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
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return {
        start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`,
        end: fmt(lastDay),
      }
    }
    case 'year':
      return {
        start: `${today.getFullYear()}-01-01`,
        end: `${today.getFullYear()}-12-31`,
      }
  }
}
