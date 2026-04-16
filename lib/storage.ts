import type { EntradaDia, ResumenDia } from './types'

export function getFechaHoy(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getLlaveEntradas(fecha: string): string {
  return `entradas_${fecha}`
}

export function cargarEntradasDia(fecha: string): EntradaDia[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(getLlaveEntradas(fecha))
  return raw ? JSON.parse(raw) : []
}

export function guardarEntrada(entrada: EntradaDia): void {
  const entradas = cargarEntradasDia(entrada.fecha)
  entradas.unshift(entrada)
  localStorage.setItem(getLlaveEntradas(entrada.fecha), JSON.stringify(entradas))
}

export function actualizarEntrada(entradaActualizada: EntradaDia): void {
  const entradas = cargarEntradasDia(entradaActualizada.fecha)
  const idx = entradas.findIndex((e) => e.id === entradaActualizada.id)
  if (idx !== -1) {
    entradas[idx] = entradaActualizada
    localStorage.setItem(getLlaveEntradas(entradaActualizada.fecha), JSON.stringify(entradas))
  }
}

function cargarTodasLasEntradas(): EntradaDia[] {
  if (typeof window === 'undefined') return []
  const todas: EntradaDia[] = []
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  for (const key of keys) {
    if (!key.startsWith('entradas_')) continue
    try {
      const raw = localStorage.getItem(key)
      if (raw) todas.push(...JSON.parse(raw))
    } catch {
      // entrada corrupta — se omite
    }
  }
  return todas
}

// Filtra por fechaMovimiento (cuándo ocurrió), no por fecha de registro
export function cargarEntradasRango(fechaInicio: string, fechaFin: string): EntradaDia[] {
  return cargarTodasLasEntradas()
    .filter((e) => {
      const fm = e.fechaMovimiento ?? e.fecha
      return fm >= fechaInicio && fm <= fechaFin
    })
    .sort((a, b) => {
      const fmA = a.fechaMovimiento ?? a.fecha
      const fmB = b.fechaMovimiento ?? b.fecha
      if (fmB !== fmA) return fmB.localeCompare(fmA)
      return (b.creadoEn ?? 0) - (a.creadoEn ?? 0)
    })
}

export type Filtro = 'hoy' | '7dias' | 'mes' | 'anio'

export function getRangoFiltro(filtro: Filtro): { inicio: string; fin: string } {
  const hoy = getFechaHoy()
  if (filtro === 'hoy') return { inicio: hoy, fin: hoy }
  if (filtro === '7dias') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { inicio: d.toISOString().split('T')[0], fin: hoy }
  }
  if (filtro === 'mes') return { inicio: `${hoy.slice(0, 7)}-01`, fin: hoy }
  return { inicio: `${hoy.slice(0, 4)}-01-01`, fin: hoy }
}

export const LABEL_FILTRO: Record<Filtro, string> = {
  hoy: 'Hoy',
  '7dias': 'Últimos 7 días',
  mes: 'Este mes',
  anio: 'Este año',
}

export function calcularResumenDia(entradas: EntradaDia[]): ResumenDia {
  let ingresos = 0
  let gastos = 0
  let pendientes = 0
  for (const entrada of entradas) {
    for (const item of entrada.items ?? []) {
      const m = typeof item.monto === 'number' && isFinite(item.monto) ? item.monto : 0
      if (item.tipo === 'ingreso') ingresos += m
      else if (item.tipo === 'gasto') gastos += m
      else if (item.tipo === 'pendiente') pendientes += m
    }
  }
  return { ingresos, gastos, pendientes }
}

export function formatPesos(monto: number): string {
  return '$' + monto.toLocaleString('es-MX')
}
