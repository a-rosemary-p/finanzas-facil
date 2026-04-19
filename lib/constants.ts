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

export const DATE_FILTERS = ['today', '7days', 'month', 'year', 'all'] as const

export const DATE_FILTER_LABELS: Record<string, string> = {
  today: 'Hoy',
  '7days': 'Últimos 7 días',
  month: 'Este mes',
  year: 'Este año',
  all: 'Histórico',
}

export const TYPE_FILTER_CONFIG = [
  { value: 'all',       label: 'Todos',      bg: '#F5F5F5', color: '#5A7A8A', border: '#E0E0E0', activeBg: '#1A2B3A', activeColor: '#fff', activeBorder: '#1A2B3A' },
  { value: 'ingreso',   label: 'Ingresos',   bg: '#F5F5F5', color: '#5A7A8A', border: '#E0E0E0', activeBg: '#C8E6C9', activeColor: '#1B5E20', activeBorder: '#A5D6A7' },
  { value: 'gasto',     label: 'Gastos',     bg: '#F5F5F5', color: '#5A7A8A', border: '#E0E0E0', activeBg: '#FFCDD2', activeColor: '#B71C1C', activeBorder: '#EF9A9A' },
  { value: 'pendiente', label: 'Pendientes', bg: '#F5F5F5', color: '#5A7A8A', border: '#E0E0E0', activeBg: '#FFF8E1', activeColor: '#E65100', activeBorder: '#FFE082' },
] as const

export const PHOTO_LIMITS = {
  maxFileSizeMB: 5,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  maxDimensionPx: 2048,
  compressionQuality: 0.8,
} as const
