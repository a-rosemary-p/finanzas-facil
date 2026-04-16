import type { EntradaDia, ResumenDia } from './types'

export function getFechaHoy(): string {
  return new Date().toISOString().split('T')[0]
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

export function calcularResumenDia(entradas: EntradaDia[]): ResumenDia {
  let ingresos = 0
  let gastos = 0
  let pendientes = 0
  for (const entrada of entradas) {
    for (const item of entrada.items) {
      if (item.tipo === 'ingreso') ingresos += item.monto
      else if (item.tipo === 'gasto') gastos += item.monto
      else if (item.tipo === 'pendiente') pendientes += item.monto
    }
  }
  return { ingresos, gastos, pendientes }
}

export function formatPesos(monto: number): string {
  return '$' + monto.toLocaleString('es-MX')
}
