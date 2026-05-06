/**
 * Helpers para resolver las categorías que un user puede usar al clasificar
 * un movimiento, según su giro (v0.292).
 *
 * - Si el user tiene `profile.giro` y ese giro está en `GIRO_CATEGORIES`,
 *   regresa las categorías personalizadas (ingresos + gastos).
 * - Si no, fallback a las genéricas (`CATEGORIES`).
 *
 * Servidor lee profile.giro en cada llamada de extracción y pasa el set
 * resuelto al prompt de la IA. No hardcodear en cliente.
 *
 * El prompt-builder (`buildCategoriesSection`) inyecta el bloque exacto que
 * va a parar al system prompt — separado de `lib/ai/prompts.ts` para no
 * meter lógica de negocio dentro del archivo de prompts.
 */

import { CATEGORIES, GIRO_CATEGORIES } from '@/lib/constants'

export interface ResolvedCategories {
  /** True si vienen de un giro mapeado; false si es el set genérico fallback. */
  fromGiro: boolean
  /** Nombre del giro si fromGiro=true; null si es fallback. */
  giro: string | null
  /** Lista plana de categorías permitidas (ingresos + gastos sin duplicados). */
  all: string[]
  /** Solo las de ingresos (vacío si fallback genérico, que no las separa). */
  ingresos: string[]
  /** Solo las de gastos (vacío si fallback genérico). */
  gastos: string[]
}

export function getCategoriesForGiro(giro: string | null | undefined): ResolvedCategories {
  if (giro && GIRO_CATEGORIES[giro]) {
    const m = GIRO_CATEGORIES[giro]
    const all = Array.from(new Set([...m.ingresos, ...m.gastos]))
    return {
      fromGiro: true,
      giro,
      all,
      ingresos: [...m.ingresos],
      gastos:   [...m.gastos],
    }
  }
  return {
    fromGiro: false,
    giro: null,
    all: [...CATEGORIES],
    ingresos: [],
    gastos:   [],
  }
}

/**
 * Construye el bloque de categorías que se inyecta en el system prompt de
 * extracción. Usa los nombres exactos del giro si los hay; si no, lista
 * genérica. SIEMPRE termina con una regla explícita de "no inventes".
 */
export function buildCategoriesSection(resolved: ResolvedCategories): string {
  if (resolved.fromGiro && resolved.giro) {
    const ingresos = resolved.ingresos.map(c => `  - "${c}"`).join('\n')
    const gastos   = resolved.gastos.map(c => `  - "${c}"`).join('\n')
    return [
      `GIRO DEL USUARIO: ${resolved.giro}`,
      ``,
      `CATEGORÍAS (usa SOLO una de esta lista exacta — son las del giro del usuario):`,
      `Ingresos:`,
      ingresos,
      `Gastos:`,
      gastos,
      ``,
      `REGLA: si el movimiento no encaja claramente en ninguna categoría de la lista, usa "Otro". NUNCA inventes categorías que no estén arriba.`,
    ].join('\n')
  }

  // Fallback genérico — tiene su propia agrupación heredada de los prompts
  // viejos (Ingresos / Operación / Negocio). Los mantenemos ahí porque eran
  // las pistas semánticas que el modelo ya conocía bien.
  return [
    `CATEGORÍAS (elige la más apropiada — usa SOLO una de esta lista exacta):`,
    `Ingresos:`,
    `  - "Ventas": venta de productos físicos o digitales.`,
    `  - "Honorarios": pago por trabajo o servicios profesionales prestados (proyectos, consultorías, freelance).`,
    `  - "Comisiones recibidas": % por venta de terceros o referidos cobrados.`,
    `  - "Reembolsos": dinero devuelto por proveedores o devoluciones a favor.`,
    `Operación:`,
    `  - "Insumos y materiales": materia prima, ingredientes, papelería, mercancía para revender.`,
    `  - "Software y suscripciones": apps, SaaS, hosting, dominios, herramientas digitales.`,
    `  - "Comisiones de plataforma": cargos cobrados por procesadores de pago, marketplaces, apps de delivery.`,
    `  - "Marketing y publicidad": ads digitales, impresos, campañas, redes sociales pagadas.`,
    `  - "Equipo y herramientas": laptops, cámaras, herramientas físicas, mobiliario operativo (bajo costo; los activos grandes van como inversión).`,
    `Negocio:`,
    `  - "Renta": local, oficina, coworking, almacén.`,
    `  - "Servicios básicos": luz, agua, gas, internet, telefonía.`,
    `  - "Transporte": gasolina, casetas, transporte público, envíos, mensajería.`,
    `  - "Honorarios profesionales": pagos a contador, abogado, asesores externos, otros freelancers contratados.`,
    `  - "Impuestos": pagos al SAT, declaraciones, retenciones.`,
    `  - "Otro": cualquier cosa que no encaje claramente arriba.`,
  ].join('\n')
}
