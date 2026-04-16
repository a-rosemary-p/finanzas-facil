export type TipoMovimiento = 'ingreso' | 'gasto' | 'pendiente'

export interface ItemMovimiento {
  tipo: TipoMovimiento
  descripcion: string
  categoria: string
  monto: number
}

export interface EntradaDia {
  id: string
  textoOriginal: string
  items: ItemMovimiento[]
  fecha: string
  creadoEn: number
}

export interface ResumenDia {
  ingresos: number
  gastos: number
  pendientes: number
}
