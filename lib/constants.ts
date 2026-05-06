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

// Categorías ACTIVAS — las que el LLM puede usar y aparecen en el dropdown.
// Renombradas/expandidas en abr 2026 para reflejar enfoque a freelancers
// y emprendedores, no solo negocios físicos. Movimientos viejos con
// categorías legacy ('Ingredientes', 'Servicios') siguen funcionando porque
// la columna `movements.category` es TEXT — solo no aparecen como opción nueva.
export const CATEGORIES = [
  // Ingresos
  'Ventas',
  'Honorarios',
  'Comisiones recibidas',
  'Reembolsos',
  // Operación
  'Insumos y materiales',
  'Software y suscripciones',
  'Comisiones de plataforma',
  'Marketing y publicidad',
  'Equipo y herramientas',
  // Negocio
  'Renta',
  'Servicios básicos',
  'Transporte',
  'Honorarios profesionales',
  'Impuestos',
  'Otro',
] as const

// Categorías LEGACY que pueden existir en la DB de antes del rediseño abr 2026.
// Las usamos en server-side validators (entry/confirm, movements/[id] PATCH) para
// que un edit no destruya el valor original — sin esto, editar un movimiento viejo
// con `category='Ingredientes'` lo coercaría a 'Otro'. NO se ofrecen en el dropdown
// ni el LLM las clasifica nuevas.
export const CATEGORIES_LEGACY = ['Ingredientes', 'Servicios'] as const

// Whitelist completa para validación server-side (acepta nuevas + legacy).
export const CATEGORIES_ALL = [...CATEGORIES, ...CATEGORIES_LEGACY] as const

// Whitelist UNIVERSAL para validación server-side (v0.292): incluye también
// todas las categorías de todos los giros. Para inserts/updates de
// `movements.category` la columna ya es TEXT (migration 009), pero los
// validators server-side coercaban a 'Otro' si no estaba en CATEGORIES_ALL.
// Con giros personalizados eso destruiría las categorías que la IA generó.
// Esta función es la check correcta.
//
// Lazy build (Set) para no recalcular en cada call. Los valores aquí son
// snapshot del módulo — si agregas un giro nuevo, se incluye automáticamente.
let _validCategorySet: Set<string> | null = null
export function isValidCategoryName(name: unknown): name is string {
  if (typeof name !== 'string') return false
  if (!_validCategorySet) {
    const set = new Set<string>(CATEGORIES_ALL)
    // Acceso lazy a GIRO_CATEGORIES — está definido más abajo en el archivo,
    // pero como Set lo construimos en runtime no hay temporal-dead-zone.
    for (const giroEntry of Object.values(GIRO_CATEGORIES)) {
      for (const c of giroEntry.ingresos) set.add(c)
      for (const c of giroEntry.gastos)   set.add(c)
    }
    _validCategorySet = set
  }
  return _validCategorySet.has(name)
}

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

// Mapeo giro → categorías personalizadas (v0.292).
// `ingresos` y `gastos` son sets sugeridos; la IA decide a qué set pertenece
// cada movimiento según el `type` que infiere. Si el user no tiene giro en
// su perfil (o el giro no está aquí), el server cae a CATEGORIES (genéricas).
//
// El último item de gastos suele ser 'Otro' por convención — para que el
// LLM tenga un escape válido cuando un movimiento no encaja en ninguna
// categoría específica del giro.
export const GIRO_CATEGORIES: Record<string, { ingresos: readonly string[]; gastos: readonly string[] }> = {
  'Restaurantes y food service': {
    ingresos: ['Venta de alimentos', 'Venta de bebidas', 'Catering y eventos', 'Renta del espacio', 'Venta en línea y delivery', 'Propinas'],
    gastos:   ['Ingredientes y alimentos', 'Bebidas e insumos de bar', 'Renta del local', 'Nómina y ayudantes', 'Gas y energía', 'Empaque y desechables', 'Mantenimiento y equipo', 'Otro'],
  },
  'Producción de alimentos y bebidas': {
    ingresos: ['Venta al menudeo', 'Venta al mayoreo', 'Venta en línea', 'Venta en mercados y ferias', 'Pedidos especiales', 'Exportación'],
    gastos:   ['Materia prima e ingredientes', 'Envases y empaque', 'Producción y maquila', 'Transporte y distribución', 'Renta de cocina o espacio', 'Etiquetas y marca', 'Otro'],
  },
  'Comercio al menudeo': {
    ingresos: ['Venta de productos', 'Venta en línea', 'Comisiones y consignación', 'Servicios adicionales', 'Renta de espacio', 'Liquidaciones y ofertas'],
    gastos:   ['Compra de inventario', 'Renta del local', 'Nómina y ayudantes', 'Transporte y fletes', 'Publicidad y redes sociales', 'Empaque y bolsas', 'Servicios básicos', 'Otro'],
  },
  'Comercio en línea': {
    ingresos: ['Venta de productos', 'Envíos cobrados al cliente', 'Venta de paquetes o bundles', 'Suscripciones', 'Afiliados y referencias', 'Comisiones de plataformas'],
    gastos:   ['Compra de inventario', 'Comisiones de plataforma', 'Envíos y paquetería', 'Publicidad digital', 'Empaque y materiales', 'Devoluciones y reembolsos', 'Otro'],
  },
  'Comercio al mayoreo': {
    ingresos: ['Venta al mayoreo', 'Venta a distribuidores', 'Venta de excedentes', 'Comisiones de venta', 'Contratos y pedidos especiales', 'Exportación'],
    gastos:   ['Compra de inventario', 'Transporte y logística', 'Almacenamiento y bodega', 'Nómina y vendedores', 'Crédito y financiamiento', 'Publicidad y promociones', 'Otro'],
  },
  'Servicios personales': {
    ingresos: ['Servicios por sesión o cita', 'Paquetes y membresías', 'Venta de productos complementarios', 'Propinas', 'Clases o talleres', 'Servicios a domicilio'],
    gastos:   ['Renta del local o silla', 'Productos e insumos', 'Equipos y herramientas', 'Cursos y capacitación', 'Publicidad y redes sociales', 'Servicios básicos', 'Otro'],
  },
  'Servicios de salud': {
    ingresos: ['Consultas', 'Procedimientos y tratamientos', 'Venta de medicamentos o suplementos', 'Estudios y análisis', 'Servicios a domicilio', 'Seguros y convenios'],
    gastos:   ['Renta del consultorio', 'Insumos y material médico', 'Medicamentos y suplementos', 'Equipos médicos', 'Seguros de responsabilidad', 'Capacitación y certificaciones', 'Servicios básicos', 'Otro'],
  },
  'Salud mental': {
    ingresos: ['Consultas presenciales', 'Consultas en línea', 'Paquetes de sesiones', 'Talleres y grupos', 'Cursos y contenido digital', 'Supervisión clínica'],
    gastos:   ['Renta del consultorio', 'Plataformas de videollamada', 'Capacitación y supervisión', 'Libros y material clínico', 'Publicidad y página web', 'Seguros profesionales', 'Otro'],
  },
  'Legal': {
    ingresos: ['Honorarios por caso', 'Honorarios por consulta', 'Retención mensual', 'Representación legal', 'Trámites y gestiones', 'Asesoría empresarial'],
    gastos:   ['Renta de oficina', 'Gastos de litigio y trámites', 'Nómina y pasantes', 'Capacitación y actualización', 'Software legal', 'Publicidad y referencias', 'Otro'],
  },
  'Financiero': {
    ingresos: ['Honorarios por asesoría', 'Comisiones por productos financieros', 'Retención mensual', 'Gestión de inversiones', 'Cursos y talleres', 'Referidos y afiliados'],
    gastos:   ['Renta de oficina', 'Licencias y certificaciones', 'Software financiero', 'Publicidad y prospección', 'Seguros de responsabilidad', 'Capacitación y cursos', 'Otro'],
  },
  'Consultoría': {
    ingresos: ['Honorarios por proyecto', 'Retención mensual', 'Talleres y capacitaciones', 'Cursos y contenido digital', 'Conferencias y ponencias', 'Referidos y afiliados'],
    gastos:   ['Renta de oficina o coworking', 'Software y herramientas digitales', 'Viajes y viáticos', 'Publicidad y marca personal', 'Capacitación y certificaciones', 'Subcontratistas', 'Otro'],
  },
  'Arquitectura e Ingeniería': {
    ingresos: ['Honorarios por proyecto', 'Supervisión de obra', 'Planos y renders', 'Consultoría técnica', 'Peritajes', 'Gestión de permisos'],
    gastos:   ['Software especializado', 'Materiales de presentación', 'Visitas a obra y transporte', 'Subcontratistas', 'Certificaciones y colegio', 'Renta de oficina', 'Otro'],
  },
  'Diseño y creativos': {
    ingresos: ['Proyectos de diseño', 'Fotografía y video', 'Edición y postproducción', 'Licencias y derechos de imagen', 'Paquetes y retenciones', 'Venta de activos digitales'],
    gastos:   ['Software creativo', 'Equipo y hardware', 'Almacenamiento y nube', 'Subcontratistas y colaboradores', 'Publicidad y portafolio', 'Transporte a locaciones', 'Otro'],
  },
  'Tecnología y desarrollo': {
    ingresos: ['Proyectos de desarrollo', 'Mantenimiento y soporte', 'Suscripciones de productos propios', 'Consultoría técnica', 'Cursos y tutoriales', 'Licencias de software'],
    gastos:   ['Software y herramientas de desarrollo', 'Hosting e infraestructura', 'APIs y servicios de terceros', 'Capacitación y cursos', 'Subcontratistas', 'Publicidad y marketing', 'Otro'],
  },
  'Marketing y contenido': {
    ingresos: ['Gestión de redes sociales', 'Campañas publicitarias', 'Creación de contenido', 'Patrocinios y colaboraciones', 'Cursos y comunidades', 'Afiliados y referidos'],
    gastos:   ['Publicidad pagada', 'Software y herramientas', 'Equipo de producción', 'Subcontratistas y colaboradores', 'Cursos y capacitación', 'Suscripciones de plataformas', 'Otro'],
  },
  'Construcción y oficios': {
    ingresos: ['Contratos de obra', 'Mano de obra por proyecto', 'Venta de materiales', 'Supervisión de obra', 'Remodelaciones y mantenimiento', 'Subcontratos'],
    gastos:   ['Materiales de construcción', 'Herramientas y equipo', 'Nómina y ayudantes', 'Transporte y flete', 'Renta de maquinaria', 'Permisos y trámites', 'Otro'],
  },
  'Taller y reparaciones': {
    ingresos: ['Reparaciones y servicio', 'Venta de refacciones y piezas', 'Mantenimiento preventivo', 'Servicio a domicilio', 'Garantías y seguimientos', 'Venta de equipos usados'],
    gastos:   ['Refacciones y piezas', 'Herramientas y equipo', 'Renta del taller', 'Nómina y ayudantes', 'Transporte a domicilios', 'Servicios básicos', 'Otro'],
  },
  'Transporte y logística': {
    ingresos: ['Fletes y envíos', 'Transporte de pasajeros', 'Servicios por plataforma', 'Mudanzas', 'Contratos de logística', 'Renta de vehículo'],
    gastos:   ['Gasolina y combustible', 'Mantenimiento del vehículo', 'Seguros vehiculares', 'Pagos de plataformas', 'Tenencia y trámites', 'Viáticos y casetas', 'Otro'],
  },
  'Turismo': {
    ingresos: ['Tours y excursiones', 'Hospedaje y renta vacacional', 'Paquetes turísticos', 'Comisiones de agencia', 'Renta de equipos', 'Servicios de guía'],
    gastos:   ['Transporte y gasolina', 'Hospedaje para grupos', 'Entradas y permisos', 'Comisiones a plataformas', 'Publicidad y redes sociales', 'Seguros y licencias', 'Otro'],
  },
  'Educación': {
    ingresos: ['Colegiaturas y mensualidades', 'Clases particulares', 'Cursos en línea', 'Talleres y seminarios', 'Venta de material didáctico', 'Asesorías y tutorías'],
    gastos:   ['Renta del espacio o plataforma', 'Material didáctico', 'Nómina de maestros', 'Publicidad y redes sociales', 'Certificaciones y capacitación', 'Software educativo', 'Otro'],
  },
  'Bienes raíces': {
    ingresos: ['Comisiones por venta', 'Comisiones por renta', 'Renta de propiedades propias', 'Administración de propiedades', 'Asesoría inmobiliaria', 'Ventas de inversión'],
    gastos:   ['Publicidad de propiedades', 'Gastos notariales y trámites', 'Mantenimiento de propiedades', 'Comisiones a plataformas', 'Transporte y visitas', 'Seguros de propiedades', 'Otro'],
  },
  'Seguros': {
    ingresos: ['Comisiones por póliza nueva', 'Comisiones por renovación', 'Bonos por producción', 'Asesoría financiera complementaria', 'Referidos y afiliados', 'Comisiones por siniestro atendido'],
    gastos:   ['Publicidad y prospección', 'Software de gestión', 'Transporte y visitas a clientes', 'Capacitación y certificaciones', 'Cuotas a aseguradora', 'Renta de oficina', 'Otro'],
  },
  'Manufactura y producción': {
    ingresos: ['Venta de productos terminados', 'Venta al mayoreo', 'Maquila para terceros', 'Venta de subproductos', 'Contratos de producción', 'Exportación'],
    gastos:   ['Materia prima', 'Maquinaria y equipo', 'Nómina y operadores', 'Energía y servicios industriales', 'Mantenimiento de equipos', 'Transporte y distribución', 'Otro'],
  },
  'Otro': {
    ingresos: ['Venta de productos', 'Venta de servicios', 'Comisiones', 'Regalías y licencias', 'Ingresos por inversiones', 'Otros ingresos'],
    gastos:   ['Compras e insumos', 'Renta y espacio', 'Nómina y colaboradores', 'Transporte', 'Publicidad', 'Servicios básicos', 'Otro'],
  },
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
