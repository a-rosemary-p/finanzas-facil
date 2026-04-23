/**
 * app/api/city-stats/route.ts
 *
 * Returns live city counts for the landing-page city counter.
 * Reads all non-empty profiles.ciudad values, groups them by metro area,
 * and returns per-cluster totals.
 *
 * Uses the service-role client so the query bypasses RLS — this is a
 * read-only aggregate (no individual user data is exposed in the response).
 *
 * Cached at the edge for 10 minutes so the landing page stays fast.
 *
 * ── Response shape ────────────────────────────────────────────────────────
 *
 *   {
 *     cities:   [{ city: 'CDMX', count: 312 }, ...],  // all 5 display cities
 *     total:    487,    // non-null profiles with a ciudad value
 *     unmapped: 41,     // profiles whose ciudad didn't match any cluster
 *     live:     true,   // always true — distinguishes from static fallback
 *   }
 *
 * ── Wiring into app/page.tsx (when ready) ────────────────────────────────
 *
 *   1. Remove the static CITIES constant.
 *
 *   2. Replace with dynamic state at the top of the component:
 *
 *      const CITIES_FALLBACK: CityCount[] = [
 *        { city: 'CDMX',         count: 0 },
 *        { city: 'Guadalajara',  count: 0 },
 *        { city: 'Tijuana',      count: 0 },
 *        { city: 'Puebla',       count: 0 },
 *        { city: 'Monterrey',    count: 0 },
 *      ]
 *
 *      const [cities, setCities] = useState<CityCount[]>(CITIES_FALLBACK)
 *
 *      useEffect(() => {
 *        fetch('/api/city-stats')
 *          .then(r => r.json())
 *          .then(data => { if (data.cities) setCities(data.cities) })
 *          .catch(() => {}) // silently keep fallback on error
 *      }, [])
 *
 *   3. Import CityCount from '@/lib/city-clusters' for typing.
 *
 * ── Adding new metro areas ────────────────────────────────────────────────
 *
 *   Edit lib/city-clusters.ts — no changes needed here.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildCityCounts } from '@/lib/city-clusters'

// ISR: revalidate every 10 minutes at the edge
export const revalidate = 600

// Service-role client — bypasses RLS for the aggregate read
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const admin = getAdmin()

    const { data, error } = await admin
      .from('profiles')
      .select('ciudad')
      .not('ciudad', 'is', null)
      .neq('ciudad', '')

    if (error) {
      console.error('[city-stats] Supabase query error', error)
      return NextResponse.json(
        { error: 'DB query failed' },
        { status: 500 }
      )
    }

    const rawCities = (data ?? []).map((row: { ciudad: string | null }) => row.ciudad)
    const result = buildCityCounts(rawCities)

    return NextResponse.json({ ...result, live: true })
  } catch (err) {
    console.error('[city-stats] Unexpected error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
