/**
 * Helpers para resolver las categorías que un user puede usar al clasificar
 * un movimiento (v0.32).
 *
 * Nuevo modelo (reemplaza el de v0.292 por giro hardcoded):
 *
 * - Cada user tiene su lista curada en `profiles.categories` (text[]) —
 *   subset del CATEGORIES_MASTER + custom strings si es Pro.
 * - `getUserCategories(profile)` lee `profile.categories`. Si está vacío
 *   (user pre-onboarding o cuenta legacy), cae a `GIRO_DEFAULTS[giro]`.
 *   Si tampoco hay giro, cae al subset genérico de `GIRO_DEFAULTS['Otro']`.
 * - `buildCategoriesSection(cats, giro)` arma el bloque del system prompt
 *   con la lista flat (no más split ingresos/gastos — la dirección la
 *   decide la IA por contexto).
 *
 * El archivo se sigue llamando `giro-categories.ts` por compatibilidad
 * con imports existentes; conceptualmente ahora es "user-categories".
 */

import { GIRO_DEFAULTS } from '@/lib/constants'

export interface ResolvedCategories {
  /** Lista plana de categorías permitidas para este user. */
  list: string[]
  /** Origen: user (curada), giro (defaults del giro), fallback genérico. */
  source: 'user' | 'giro' | 'fallback'
  /** Giro del user si está disponible (para passearlo al prompt). */
  giro: string | null
}

const GENERIC_FALLBACK = GIRO_DEFAULTS['Otro']

interface ProfileSlice {
  categories?: string[] | null
  giro?: string | null
}

export function getUserCategories(profile: ProfileSlice | null | undefined): ResolvedCategories {
  if (profile?.categories && profile.categories.length > 0) {
    return {
      list: [...profile.categories],
      source: 'user',
      giro: profile.giro ?? null,
    }
  }
  if (profile?.giro && GIRO_DEFAULTS[profile.giro]) {
    return {
      list: [...GIRO_DEFAULTS[profile.giro]],
      source: 'giro',
      giro: profile.giro,
    }
  }
  return {
    list: [...GENERIC_FALLBACK],
    source: 'fallback',
    giro: profile?.giro ?? null,
  }
}

/**
 * Wrapper backwards-compat para callers que aún importan getCategoriesForGiro.
 * Nuevo código debería usar getUserCategories directo.
 */
export function getCategoriesForGiro(giro: string | null | undefined): ResolvedCategories {
  return getUserCategories({ giro, categories: null })
}

/**
 * Construye el bloque de categorías que se inyecta en el system prompt de
 * extracción. v0.32: lista flat (no split ingresos/gastos — la dirección
 * la decide la IA por contexto, según las nuevas reglas del master list).
 */
export function buildCategoriesSection(resolved: ResolvedCategories): string {
  const lines: string[] = []

  if (resolved.giro) {
    lines.push(`GIRO DEL USUARIO: ${resolved.giro}`)
    lines.push('')
  }

  lines.push('CATEGORÍAS (usa SOLO una de esta lista exacta — son las categorías que el usuario eligió para su negocio):')
  for (const cat of resolved.list) {
    lines.push(`  - "${cat}"`)
  }
  lines.push('')
  lines.push('IMPORTANTE:')
  lines.push('- Estas categorías son DIRECCIÓN-NEUTRA: pueden ser un ingreso o un gasto dependiendo del contexto del movimiento (ej: "Renta" se cobra o se paga, "Servicios" se vende o se contrata). Tú decides el `type` ingreso/gasto/pendiente según lo que describe el usuario; la categoría solo etiqueta de QUÉ trata el movimiento.')
  lines.push('- Si el movimiento no encaja claramente en ninguna categoría de la lista, usa "Otro". NUNCA inventes categorías que no estén arriba.')

  return lines.join('\n')
}
