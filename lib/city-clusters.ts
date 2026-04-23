/**
 * lib/city-clusters.ts
 *
 * Maps raw city names from profiles.ciudad to the 5 canonical display cities
 * shown on the landing page city counter. Cities in the same metro area are
 * grouped under their main city.
 *
 * Pure utility — no DB access. Works in browser or server.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *
 *   import { canonicalizeCity, buildCityCounts } from '@/lib/city-clusters'
 *
 *   canonicalizeCity('Zapopan')            // → 'Guadalajara'
 *   canonicalizeCity('Tecate')             // → 'Tijuana'
 *   canonicalizeCity('Estado de México')   // → 'CDMX'
 *   canonicalizeCity('Mérida')             // → null  (not tracked)
 *   canonicalizeCity(null)                 // → null
 *
 *   buildCityCounts(['Monterrey', 'Zapopan', 'Mérida', null, 'CDMX'])
 *   // → {
 *   //     cities:   [{ city: 'CDMX', count: 1 }, { city: 'Guadalajara', count: 1 },
 *   //                { city: 'Tijuana', count: 0 }, { city: 'Puebla', count: 0 },
 *   //                { city: 'Monterrey', count: 1 }],
 *   //     total:    3,   // non-null entries
 *   //     unmapped: 1,   // non-null but not in any cluster (Mérida)
 *   //   }
 *
 * ── Adding new cities ──────────────────────────────────────────────────────
 *
 *   Add the lowercase/no-accent alias to the relevant cluster's `aliases` array.
 *   No other changes needed.
 *
 * ── Wiring to the landing page (when ready) ───────────────────────────────
 *
 *   See app/api/city-stats/route.ts for the API endpoint and the usage
 *   comment showing how to replace the static CITIES array in app/page.tsx.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisplayCity = 'CDMX' | 'Guadalajara' | 'Tijuana' | 'Puebla' | 'Monterrey'

export type CityCount = { city: DisplayCity; count: number }

type Cluster = {
  display: DisplayCity
  /**
   * Lowercase, diacritic-stripped aliases. The matcher checks for
   * exact equality and leading-substring matches (see canonicalizeCity).
   */
  aliases: string[]
}

// ─── Cluster definitions ─────────────────────────────────────────────────────

const CLUSTERS: Cluster[] = [
  {
    display: 'CDMX',
    aliases: [
      // Core CDMX
      'cdmx', 'ciudad de mexico', 'ciudad de méxico',
      'df', 'd.f.', 'd.f', 'distrito federal', 'capital',
      // Alcaldías (CDMX boroughs)
      'iztapalapa',
      'gustavo a madero', 'gustavo a. madero',
      'alvaro obregon', 'álvaro obregón',
      'coyoacan', 'coyoacán',
      'tlalpan',
      'xochimilco',
      'tlahuac', 'tláhuac',
      'venustiano carranza',
      'cuauhtemoc', 'cuauhtémoc',
      'benito juarez', 'benito juárez',
      'miguel hidalgo',
      'iztacalco',
      'magdalena contreras', 'la magdalena contreras',
      'cuajimalpa', 'cuajimalpa de morelos',
      'milpa alta',
      'azcapotzalco',
      // Estado de México — Zona Metropolitana del Valle de México
      'estado de mexico', 'estado de méxico', 'edomex', 'edoméx',
      'ecatepec', 'ecatepec de morelos',
      'naucalpan', 'naucalpan de juarez', 'naucalpan de juárez',
      'tlalnepantla', 'tlalnepantla de baz',
      'nezahualcoyotl', 'nezahualcóyotl', 'cd nezahualcoyotl', 'neza',
      'chimalhuacan', 'chimalhuacán',
      'valle de chalco', 'valle de chalco solidaridad',
      'tultitlan', 'tultitlán',
      'cuautitlan izcalli', 'cuautitlán izcalli',
      'cuautitlan', 'cuautitlán',
      'texcoco',
      'huixquilucan', 'interlomas',
      'atizapan', 'atizapán', 'atizapan de zaragoza', 'atizapán de zaragoza',
      'coacalco', 'coacalco de berriozabal', 'coacalco de berriozábal',
      'tultepec',
      'chalco',
      'ixtapaluca',
      'tecamac', 'tecámac',
      'zumpango',
      'nicolas romero', 'nicolás romero',
      'tepotzotlan', 'tepotzotlán',
      'la paz',
      'chicoloapan',
      'huehuetoca',
      'nextlalpan',
    ],
  },

  {
    display: 'Guadalajara',
    aliases: [
      'guadalajara', 'gdl',
      'zapopan',
      'tlaquepaque', 'san pedro tlaquepaque',
      'tonala', 'tonalá',
      'tlajomulco', 'tlajomulco de zuniga', 'tlajomulco de zúñiga',
      'el salto',
      'juanacatlan', 'juanacatlán',
      'ixtlahuacan de los membrillos', 'ixtlahuacán de los membrillos',
      'zmg',
    ],
  },

  {
    display: 'Tijuana',
    aliases: [
      'tijuana', 'tj',
      'tecate',
      'rosarito', 'playas de rosarito',
      // Ensenada is ~100 km south but same region (Baja California Norte)
      'ensenada',
    ],
  },

  {
    display: 'Puebla',
    aliases: [
      'puebla', 'puebla de zaragoza', 'heroica puebla de zaragoza',
      'san andres cholula', 'san andrés cholula',
      'san pedro cholula',
      'cholula',
      'cuautlancingo',
      'amozoc', 'amozoc de mota',
      'huejotzingo',
      'ocoyucan',
    ],
  },

  {
    display: 'Monterrey',
    aliases: [
      'monterrey', 'mty',
      // ZMM — Zona Metropolitana de Monterrey
      'san nicolas de los garza', 'san nicolás de los garza',
      'san nicolas', 'san nicolás',                        // commonly written alone
      'guadalupe',                                          // Guadalupe, NL
      'san pedro garza garcia', 'san pedro garza garcía',
      'spgg',
      'apodaca',
      'general escobedo', 'escobedo',
      'santa catarina', 'santa catalina',
      'garcia nl', 'garcía nl', 'garcia nuevo leon',       // avoid matching "Garcia" generically
      'garcia, nl', 'garcía, nl',
      'juarez nl', 'juárez nl', 'juarez, nl', 'juárez, nl', // Juárez, NL ≠ Cd. Juárez
      'cadereyta', 'cadereyta jimenez', 'cadereyta jiménez',
      'santiago nl', 'santiago, nl',                       // Santiago, NL
      'salinas victoria',
      'pesqueria', 'pesquería',
      'ciénega de flores', 'cienega de flores',
      'el carmen', 'carmen nl',
    ],
  },
]

// ─── Ordered list for display ────────────────────────────────────────────────

/** Ordered list of display cities — mirrors the order in app/page.tsx */
export const DISPLAY_CITIES: readonly DisplayCity[] = [
  'CDMX',
  'Guadalajara',
  'Tijuana',
  'Puebla',
  'Monterrey',
]

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Strips diacritics and lowercases a string for comparison.
 *
 *   normalizeCity('Zapopán')        → 'zapopan'
 *   normalizeCity('México, D.F.')   → 'mexico, d.f.'
 *   normalizeCity('  MONTERREY  ')  → 'monterrey'
 */
export function normalizeCity(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining diacriticals
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')              // collapse internal whitespace
}

// ─── Matching ────────────────────────────────────────────────────────────────

/**
 * Maps a raw city string to its canonical display city, or null if not found.
 *
 * Matching is tried in this order for each alias:
 *   1. Exact: "monterrey" === "monterrey"
 *   2. Input starts with alias + separator: "monterrey, nl" → "monterrey"
 *   3. Alias starts with input + separator: "san nicolas de los garza" → "san nicolas"
 *
 * Separators checked: comma, space. This handles "City, State" and "City State"
 * formats without accidentally matching short names inside unrelated cities.
 */
export function canonicalizeCity(raw: string | null | undefined): DisplayCity | null {
  if (!raw) return null
  const n = normalizeCity(raw)
  if (!n) return null

  for (const cluster of CLUSTERS) {
    for (const alias of cluster.aliases) {
      const a = normalizeCity(alias)
      if (
        n === a ||
        n.startsWith(a + ',') ||
        n.startsWith(a + ' ') ||
        a.startsWith(n + ',') ||
        a.startsWith(n + ' ')
      ) {
        return cluster.display
      }
    }
  }
  return null
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregates an array of raw city strings from profiles into per-cluster counts.
 * Null/empty entries are skipped. Entries that don't map to a cluster are counted
 * in `unmapped` (useful for deciding when to add new clusters).
 */
export function buildCityCounts(rawCities: (string | null | undefined)[]): {
  cities: CityCount[]
  total: number
  unmapped: number
} {
  const counts = Object.fromEntries(
    DISPLAY_CITIES.map(c => [c, 0])
  ) as Record<DisplayCity, number>

  let unmapped = 0

  for (const raw of rawCities) {
    if (!raw) continue
    const canonical = canonicalizeCity(raw)
    if (canonical) {
      counts[canonical]++
    } else {
      unmapped++
    }
  }

  return {
    cities: DISPLAY_CITIES.map(city => ({ city, count: counts[city] })),
    total: rawCities.filter(Boolean).length,
    unmapped,
  }
}
