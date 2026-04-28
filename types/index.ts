// Fuente de verdad de todos los tipos de la app.
// Nunca definir tipos inline en componentes o funciones.

export type Plan = 'free' | 'pro'
export type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete_expired'
export type MovementType = 'ingreso' | 'gasto' | 'pendiente'
// Categorías de movimiento. Las activas son las que el LLM clasifica y el
// dropdown ofrece. Las legacy son valores históricos que pueden venir de la
// DB (movs creados pre-rediseño abr 2026) — quedan en el union para que
// TypeScript no marque error al leer datos antiguos.
export type Category =
  // Activas
  | 'Ventas'
  | 'Honorarios'
  | 'Comisiones recibidas'
  | 'Reembolsos'
  | 'Insumos y materiales'
  | 'Software y suscripciones'
  | 'Comisiones de plataforma'
  | 'Marketing y publicidad'
  | 'Equipo y herramientas'
  | 'Renta'
  | 'Servicios básicos'
  | 'Transporte'
  | 'Honorarios profesionales'
  | 'Impuestos'
  | 'Otro'
  // Legacy (pre abr 2026)
  | 'Ingredientes'
  | 'Servicios'
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
  /** Timestamp ISO cuando el user terminó/saltó el onboarding. NULL = no lo
   * ha visto, dispara el flow inline en /registros. */
  onboardedAt?: string | null
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
  /**
   * Audit trail (v0.27 sprint 1):
   * - `paidAt`: ISO timestamp cuando un pendiente fue marcado como pagado.
   *   Solo está presente si el movimiento tuvo origen en un pendiente.
   * - `originalType`: tipo del movimiento al crearse. Útil para distinguir
   *   "este gasto fue un pendiente que pagué" vs "gasto registrado directo".
   */
  paidAt?: string | null
  originalType?: MovementType | null
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
