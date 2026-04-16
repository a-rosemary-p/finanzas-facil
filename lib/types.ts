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
  fecha: string           // fecha de registro (llave localStorage)
  fechaMovimiento: string // fecha real del movimiento (YYYY-MM-DD), editable
  creadoEn: number
}

export interface ResumenDia {
  ingresos: number
  gastos: number
  pendientes: number
}
