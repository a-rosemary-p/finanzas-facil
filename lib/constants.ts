// Constantes de negocio centralizadas.
// Si alguien quiere cambiar un límite o precio, solo toca este archivo.

export const AI_MODEL = 'gpt-4.1-mini' as const
export const VISION_MODEL = 'gpt-4o' as const        // mejor calidad OCR en imágenes
export const OCR_MIN_TEXT_LENGTH = 20                 // mín. caracteres para considerar OCR exitoso

export const EXCHANGE_RATES = {
  USD_TO_MXN: 17,
  EUR_TO_MXN: 18.5,
} as const

export const PLANS = {
  FREE: {
    maxMovementsPerDay: 10,
    historyDays: 30,
  },
  PRO: {
    maxMovementsPerDay: Infinity,
    historyDays: Infinity,
    priceMonthlyMXN: 49,
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

export const MOVEMENT_TYPE_CONFIG = {
  ingreso:   { label: 'Ingreso',   bg: 'var(--income-bg)',  color: 'var(--income-text)',  border: 'var(--income-border)',  sign: '+' },
  gasto:     { label: 'Gasto',     bg: 'var(--expense-bg)', color: 'var(--expense-text)', border: 'var(--expense-border)', sign: '−' },
  pendiente: { label: 'Pendiente', bg: 'var(--pending-bg)', color: 'var(--pending-text)', border: 'var(--pending-border)', sign: '⏳ ' },
} as const

export const TYPE_FILTER_CONFIG = [
  { value: 'all',       label: 'Todos',      bg: '#F4F6EB', color: '#6B8C78', border: '#D9E8D0', activeBg: '#578466', activeColor: '#fff',    activeBorder: '#578466' },
  { value: 'ingreso',   label: 'Ingresos',   bg: '#F4F6EB', color: '#6B8C78', border: '#D9E8D0', activeBg: '#DAE68F', activeColor: '#578466', activeBorder: '#92C3A5' },
  { value: 'gasto',     label: 'Gastos',     bg: '#F4F6EB', color: '#6B8C78', border: '#D9E8D0', activeBg: '#FAD5BF', activeColor: '#D0481A', activeBorder: '#F79366' },
  { value: 'pendiente', label: 'Pendientes', bg: '#F4F6EB', color: '#6B8C78', border: '#D9E8D0', activeBg: '#FFF5CC', activeColor: '#B89010', activeBorder: '#FFCE57' },
] as const

export const GIROS = [
  'Alimentos y bebidas',
  'Comercio al menudeo',
  'Comercio al mayoreo',
  'Servicios personales',
  'Servicios de salud',
  'Servicios profesionales',
  'Servicios financieros',
  'Taller y reparaciones',
  'Construcción y oficios',
  'Transporte y logística',
  'Educación',
  'Tecnología y servicios',
  'Otro',
] as const

export const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur',
  'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos',
  'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro',
  'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas',
] as const

export const TIMEZONE_MAP: Record<string, string> = {
  'Baja California': 'America/Tijuana',
  'Chihuahua': 'America/Chihuahua',
  'Sonora': 'America/Hermosillo',
  'Sinaloa': 'America/Mazatlan',
  'Nayarit': 'America/Mazatlan',
  // todos los demás → America/Mexico_City (default)
}

export const PHOTO_LIMITS = {
  maxFileSizeMB: 5,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  maxDimensionPx: 2048,
  compressionQuality: 0.8,
} as const
