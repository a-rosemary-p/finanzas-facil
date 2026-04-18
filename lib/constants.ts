// Constantes de negocio centralizadas.
// Si alguien quiere cambiar un límite o precio, solo toca este archivo.

export const PLANS = {
  FREE: {
    maxMovementsPerDay: 10,
    historyDays: 30,
  },
  PRO: {
    maxMovementsPerDay: Infinity,
    historyDays: Infinity,
    priceMonthlyMXN: 99,
  },
} as const

export const CATEGORIES = [
  'Ventas',
  'Ingredientes',
  'Servicios',
  'Transporte',
  'Renta',
  'Servicios básicos',
  'Otro',
] as const

export const MOVEMENT_TYPES = ['ingreso', 'gasto', 'pendiente'] as const

export const DATE_FILTERS = ['today', '7days', 'month', 'year'] as const

export const DATE_FILTER_LABELS: Record<string, string> = {
  today: 'Hoy',
  '7days': 'Últimos 7 días',
  month: 'Este mes',
  year: 'Este año',
}

export const PHOTO_LIMITS = {
  maxFileSizeMB: 5,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  maxDimensionPx: 2048,
  compressionQuality: 0.8,
} as const
