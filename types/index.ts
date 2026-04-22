// Fuente de verdad de todos los tipos de la app.
// Nunca definir tipos inline en componentes o funciones.

export type Plan = 'free' | 'pro'
export type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete_expired'
export type MovementType = 'ingreso' | 'gasto' | 'pendiente'
export type Category =
  | 'Ventas'
  | 'Ingredientes'
  | 'Servicios'
  | 'Transporte'
  | 'Renta'
  | 'Servicios básicos'
  | 'Otro'
export type DateFilter = 'today' | '7days' | 'month' | 'year' | 'all' | 'custom'
export type TypeFilter = 'all' | 'ingreso' | 'gasto' | 'pendiente'

export interface FilterState {
  type: DateFilter
  selectedMonth?: Date   // para 'month': qué mes específico (null = mes actual)
  customRange?: { from: Date; to: Date } // para 'custom' (futuro)
}

export interface DashboardFilters {
  dateFilter: FilterState
  showInvestments: boolean
}
export type InputMode = 'text' | 'voice' | 'photo'

export interface Profile {
  id: string
  email: string
  displayName: string
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  movementsToday: number
  totalMovements: number
  giro?: string
  ciudad?: string
  estado?: string
  timezone?: string
  monedaPreferida?: 'MXN' | 'USD'
  mostrarInversiones?: boolean
  mostrarPendientes?: boolean
  trialUsed: boolean  // true una vez que el usuario activó el trial por primera vez
}

export interface ProfileUpdate {
  displayName?: string
  giro?: string
  ciudad?: string
  estado?: string
}

export interface SettingsUpdate {
  monedaPreferida?: 'MXN' | 'USD'
  mostrarInversiones?: boolean
  mostrarPendientes?: boolean
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
  isInvestment: boolean
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
  isInvestment?: boolean
  originalAmount?: number
  originalCurrency?: 'MXN' | 'USD' | 'EUR'
  exchangeRateUsed?: number
}

export interface DashboardMetrics {
  income: number
  expenses: number
  net: number
}
