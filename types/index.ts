// Fuente de verdad de todos los tipos de la app.
// Nunca definir tipos inline en componentes o funciones.

export type Plan = 'free' | 'pro'
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled'
export type MovementType = 'ingreso' | 'gasto' | 'pendiente'
export type Category =
  | 'Ventas'
  | 'Ingredientes'
  | 'Servicios'
  | 'Transporte'
  | 'Renta'
  | 'Servicios básicos'
  | 'Otro'
export type DateFilter = 'today' | '7days' | 'month' | 'year' | 'all'
export type TypeFilter = 'all' | 'ingreso' | 'gasto' | 'pendiente'
export type InputMode = 'text' | 'voice' | 'photo'

export interface Profile {
  id: string
  email: string
  displayName: string
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  movementsToday: number
}

export interface Entry {
  id: string
  rawText: string
  entryDate: string      // YYYY-MM-DD
  createdAt: string
  movements: Movement[]
}

export interface Movement {
  id: string
  type: MovementType
  amount: number
  description: string
  category: Category
  movementDate: string   // YYYY-MM-DD
}

// Movimiento pendiente de confirmación (antes de guardar en DB)
export interface PendingMovement {
  tempId: string          // ID temporal para UI
  type: MovementType
  amount: number
  description: string
  category: Category
  movementDate: string
  dayLabel?: string       // "Lunes 14", "Martes 15" — para multi-día
}

export interface DashboardMetrics {
  income: number
  expenses: number
  net: number
}
