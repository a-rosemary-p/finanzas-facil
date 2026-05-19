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
    historyDays: 30,        // ventana rolling para el historial del dashboard
    historyMonths: 3,       // ventana en meses calendario para /reportes (mes actual + 2 anteriores)
  },
  PRO: {
    maxMovementsPerDay: Infinity,
    historyDays: Infinity,
    historyMonths: Infinity,
    priceMonthlyMXN: 49,
  },
} as const

// CATEGORÍAS — master list flat (v0.32, may 2026).
//
// Cambio de modelo grande: reemplaza el sistema viejo donde cada giro tenía
// un set hardcoded de ~12 categorías muy específicas (GIRO_CATEGORIES).
// Las categorías son intencionalmente genéricas — la dirección (ingreso vs
// gasto) la decide la IA en cada movimiento según el contexto. Ej: "Renta"
// puede ser un cobro o un pago, "Servicios" se cobra o se paga.
//
// Cada user tiene su lista curada (subset del master + custom strings si es
// Pro) guardada en `profiles.categories`. Esta lista es la fuente de verdad
// — el AI prompt y los dropdowns leen de ahí, no de aquí.
//
// El master list se mantiene como referencia para:
//  - El picker UI (pills addable que no están aún en la lista del user)
//  - GIRO_DEFAULTS para pre-selección al onboarding
//  - Validación opcional cuando un user Free intenta agregar custom
export const CATEGORIES_MASTER = [
  'Ventas',
  'Servicios',
  'Inventario',
  'Insumos',
  'Renta',
  'Nómina',
  'Colaboradores',
  'Publicidad',
  'Transporte',
  'Operación',
  'Servicios básicos',
  'Equipo',
  'Capacitación',
  'Impuestos',
  'Trámites',
  'Financiamiento',
  'Regalías',
  'Licencias',
  'Otro',
] as const

// Alias retro-compat: código viejo importaba `CATEGORIES` como la lista
// activa. Apunta al master para que pre-v0.32 imports no truenen.
export const CATEGORIES = CATEGORIES_MASTER

// Categorías heredadas de modelos anteriores que pueden existir en la DB.
// Solo se usan en histórico — el dropdown del user nuevo no las muestra a
// menos que las haya re-activado en su lista (categorías personalizadas
// efectivamente las "recuperan" como cualquier otra). La columna
// `movements.category` es TEXT, así que cualquier valor histórico sigue
// funcionando para display.
export const CATEGORIES_LEGACY = ['Ingredientes', 'Servicios'] as const

// Whitelist mínima para validación server-side en código viejo. Hoy en
// día isValidCategoryName() acepta cualquier string razonable (1-40 chars)
// — la constraint real vive en el flow UI + AI prompt que solo expone la
// lista del user.
export const CATEGORIES_ALL = [...CATEGORIES_MASTER, ...CATEGORIES_LEGACY] as const

/**
 * Valida un nombre de categoría para inserts/updates (v0.32).
 *
 * Antes: closed set contra `CATEGORIES_ALL` + cats hardcoded de los 24 giros.
 * Esto coercía a 'Otro' cualquier categoría custom que el user agregara o
 * que la IA generara fuera del closed set.
 *
 * Ahora: open string. Cada user tiene su propia lista (incluyendo custom),
 * y la fuente de verdad es `profiles.categories`. El validator solo verifica
 * que sea string no-vacío de longitud razonable. La constraint real vive en:
 *  1. El prompt del LLM (que solo recibe la lista del user).
 *  2. La UI (pickers solo muestran cats del user).
 *  3. El endpoint /api/profile/categories que valida la lista al guardar.
 */
export function isValidCategoryName(name: unknown): name is string {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= 40
}

// Cap total de categorías en la lista de un user (master + custom).
// Pro-only feature; Free cura del master pero no agrega custom.
export const USER_CATEGORIES_CAP = 40

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

// Lista de giros (v0.292) — reemplaza la lista vieja en may 2026 cuando
// introducimos categorías personalizadas por giro. Los users con giros
// viejos en su perfil ('Alimentos y bebidas', 'Servicios profesionales',
// 'Tecnología y servicios') siguen funcionando: el lookup de categorías
// regresa el set genérico cuando el giro no está en GIRO_CATEGORIES, así
// que no rompe nada — solo no obtienen categorías personalizadas hasta
// que actualicen su giro.
export const GIROS = [
  'Restaurantes y food service',
  'Producción de alimentos y bebidas',
  'Comercio al menudeo',
  'Comercio en línea',
  'Comercio al mayoreo',
  'Servicios personales',
  'Servicios de salud',
  'Salud mental',
  'Legal',
  'Financiero',
  'Consultoría',
  'Arquitectura e Ingeniería',
  'Diseño y creativos',
  'Tecnología y desarrollo',
  'Marketing y contenido',
  'Construcción y oficios',
  'Taller y reparaciones',
  'Transporte y logística',
  'Turismo',
  'Educación',
  'Bienes raíces',
  'Seguros',
  'Manufactura y producción',
  'Otro',
] as const

/**
 * Pre-selección sugerida de categorías al elegir un giro al onboarding.
 * Subset del CATEGORIES_MASTER que tiene sentido para ese tipo de negocio.
 * El user puede agregar/quitar libremente desde el picker — esto es solo
 * el punto de arranque para no llegar a una lista vacía.
 *
 * Si el giro no está mapeado, fallback a GIRO_DEFAULTS['Otro']. Si tampoco
 * hay giro (user sin onboarding completo), fallback a un set genérico
 * vía getUserCategories() (lib/giro-categories.ts).
 */
export const GIRO_DEFAULTS: Record<string, string[]> = {
  'Restaurantes y food service':       ['Ventas', 'Insumos', 'Inventario', 'Renta', 'Nómina', 'Servicios básicos', 'Equipo', 'Publicidad', 'Otro'],
  'Producción de alimentos y bebidas': ['Ventas', 'Insumos', 'Inventario', 'Equipo', 'Transporte', 'Operación', 'Publicidad', 'Otro'],
  'Comercio al menudeo':               ['Ventas', 'Inventario', 'Renta', 'Nómina', 'Publicidad', 'Servicios básicos', 'Transporte', 'Otro'],
  'Comercio en línea':                 ['Ventas', 'Inventario', 'Publicidad', 'Transporte', 'Operación', 'Servicios básicos', 'Licencias', 'Otro'],
  'Comercio al mayoreo':               ['Ventas', 'Inventario', 'Transporte', 'Operación', 'Nómina', 'Financiamiento', 'Publicidad', 'Otro'],
  'Servicios personales':              ['Servicios', 'Renta', 'Insumos', 'Equipo', 'Publicidad', 'Servicios básicos', 'Capacitación', 'Otro'],
  'Servicios de salud':                ['Servicios', 'Renta', 'Insumos', 'Equipo', 'Nómina', 'Capacitación', 'Servicios básicos', 'Licencias', 'Otro'],
  'Salud mental':                      ['Servicios', 'Renta', 'Operación', 'Capacitación', 'Publicidad', 'Servicios básicos', 'Otro'],
  'Legal':                             ['Servicios', 'Renta', 'Nómina', 'Trámites', 'Capacitación', 'Publicidad', 'Operación', 'Otro'],
  'Financiero':                        ['Servicios', 'Renta', 'Operación', 'Publicidad', 'Capacitación', 'Licencias', 'Otro'],
  'Consultoría':                       ['Servicios', 'Operación', 'Publicidad', 'Capacitación', 'Transporte', 'Colaboradores', 'Otro'],
  'Arquitectura e Ingeniería':         ['Servicios', 'Operación', 'Colaboradores', 'Equipo', 'Transporte', 'Trámites', 'Capacitación', 'Otro'],
  'Diseño y creativos':                ['Servicios', 'Operación', 'Equipo', 'Publicidad', 'Colaboradores', 'Licencias', 'Otro'],
  'Tecnología y desarrollo':           ['Servicios', 'Operación', 'Equipo', 'Licencias', 'Publicidad', 'Capacitación', 'Colaboradores', 'Otro'],
  'Marketing y contenido':             ['Servicios', 'Publicidad', 'Operación', 'Colaboradores', 'Equipo', 'Licencias', 'Otro'],
  'Construcción y oficios':            ['Servicios', 'Insumos', 'Inventario', 'Equipo', 'Nómina', 'Transporte', 'Trámites', 'Otro'],
  'Taller y reparaciones':             ['Servicios', 'Insumos', 'Inventario', 'Equipo', 'Renta', 'Servicios básicos', 'Transporte', 'Otro'],
  'Transporte y logística':            ['Servicios', 'Operación', 'Transporte', 'Equipo', 'Nómina', 'Licencias', 'Trámites', 'Otro'],
  'Turismo':                           ['Servicios', 'Transporte', 'Operación', 'Publicidad', 'Colaboradores', 'Licencias', 'Otro'],
  'Educación':                         ['Servicios', 'Renta', 'Nómina', 'Insumos', 'Publicidad', 'Capacitación', 'Servicios básicos', 'Otro'],
  'Bienes raíces':                     ['Servicios', 'Publicidad', 'Trámites', 'Transporte', 'Operación', 'Renta', 'Otro'],
  'Seguros':                           ['Servicios', 'Publicidad', 'Transporte', 'Capacitación', 'Licencias', 'Renta', 'Otro'],
  'Manufactura y producción':          ['Ventas', 'Insumos', 'Inventario', 'Equipo', 'Nómina', 'Servicios básicos', 'Transporte', 'Operación', 'Otro'],
  'Otro':                              ['Ventas', 'Servicios', 'Renta', 'Insumos', 'Nómina', 'Transporte', 'Operación', 'Otro'],
}

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
  maxFileSizeMB: 5,                       // imágenes
  pdfMaxFileSizeMB: 10,                   // PDFs (multi-página puede pesar más)
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxDimensionPx: 2048,
  compressionQuality: 0.8,
} as const
