/**
 * /admin/analytics — dashboard interno de founders.
 *
 * Acceso:
 *   - Sin sesión           → /login (vía middleware proxy.ts)
 *   - Auth pero NO founder → redirect a /inicio
 *   - Founder              → render
 *
 * No hay link a esta ruta desde ningún lado del app — solo URL directa.
 *
 * Estrategia de datos:
 *   - Server Component, queries via service-role client (bypassea RLS).
 *   - Excluye los IDs de cuentas internas del founder team de TODOS los
 *     conteos (definidos en EXCLUDE_USER_IDS).
 *   - Botón "Actualizar" en el client component dispara router.refresh()
 *     que re-evalúa este server component.
 *
 * Performance: para miles de usuarios esto sigue siendo barato (un select
 * por tabla). Si crece a 100K+ users habrá que pasar a queries SQL
 * agregadas en una RPC.
 */

import { redirect } from 'next/navigation'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { AdminAnalytics } from './admin-analytics'

// ── Allowlist de founders ────────────────────────────────────────────────
const FOUNDER_EMAILS = new Set<string>([
  'aromeropompa@gmail.com',
  'hgvictor0@gmail.com',
])

// IDs internos a excluir de todos los analytics (cuentas test de founders)
const EXCLUDE_USER_IDS: readonly string[] = [
  'c51ea800-79d4-4e28-9a0c-79f0e62a7d6f',
  'e95bfc3d-4b1f-4db3-92d4-a78ec888c49a',
  'c41b873a-2bfc-408a-9f8d-776c7e6f686e',
  'e8f35fb0-7df0-416e-a739-b8547158de63',
  '6a7258d6-f71a-40f0-8445-7f1652013063',
  '15933f7d-8025-43ef-9294-0fee569a718d',
]

const PRO_PRICE_MXN = 49

// Server Component — fuerza re-render en cada navegación (no cachear)
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ProfileRow {
  id: string
  email: string
  display_name: string | null
  plan: string | null
  subscription_status: string | null
  created_at: string
  total_movements: number | null
  giro: string | null
}

interface MovementRow {
  user_id: string
  movement_date: string
  created_at: string
}

interface EntryRow {
  user_id: string
  input_source: string | null
  created_at: string
}

interface PageViewEvent {
  user_id: string | null
  created_at: string
  payload: {
    path?: string
    visitor_id?: string
    session_id?: string
    referrer?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    is_first_in_session?: boolean
    country?: string
    device?: 'mobile' | 'tablet' | 'desktop'
    ua?: string
  }
}

/**
 * Parsea el sistema operativo del user-agent. Usado en /admin/analytics
 * (page tab) para mostrar la distribución de OS — no lo guardamos como
 * campo separado en analytics_events porque se puede derivar del `ua`
 * que ya guardamos truncado a 200 chars.
 *
 * El orden de checks importa: iPadOS reporta "Macintosh" en Safari 13+ pero
 * con touch points; lo aproximamos por presencia de "iPad" o "Mobile" en UA.
 * Para Android verificamos antes de Linux porque Android es Linux también.
 */
function parseOS(ua: string): string {
  const u = ua
  if (!u) return 'desconocido'
  if (/iPhone|iPod/.test(u)) return 'iOS'
  if (/iPad/.test(u))         return 'iPadOS'
  if (/Android/.test(u))      return 'Android'
  if (/Windows NT/.test(u))   return 'Windows'
  if (/Mac OS X|Macintosh/.test(u)) return 'macOS'
  if (/CrOS/.test(u))         return 'ChromeOS'
  if (/Linux/.test(u))        return 'Linux'
  return 'Otro'
}

export default async function AdminAnalyticsPage() {
  // ── 1. Auth + allowlist ─────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // El middleware ya redirigió a /login si no hay user, pero defense-in-depth.
  if (!user) redirect('/login')

  const email = (user.email || '').toLowerCase()
  if (!FOUNDER_EMAILS.has(email)) {
    redirect('/inicio')
  }

  // ── 2. Service-role client para bypass de RLS ───────────────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // PostgREST `not.in.()` requiere paréntesis y comma-separated.
  const excludeFilter = `(${EXCLUDE_USER_IDS.join(',')})`

  // ── 3. Fetch en paralelo ────────────────────────────────────────────
  // Para page analytics: traemos page_viewed events de los últimos 30 días.
  // Es OK tener TODOS en memoria — Vercel reportó ~6K/30d, postgres-rest
  // tiene cap de 1000 por default, así que pedimos hasta 50K vía range.
  const pvCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [profilesRes, movementsRes, entriesRes, recurringRes, pvRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, display_name, plan, subscription_status, created_at, total_movements, giro')
      .not('id', 'in', excludeFilter)
      .order('created_at', { ascending: false }),
    admin
      .from('movements')
      .select('user_id, movement_date, created_at')
      .not('user_id', 'in', excludeFilter),
    admin
      .from('entries')
      .select('user_id, input_source, created_at')
      .not('user_id', 'in', excludeFilter),
    admin
      .from('recurring_movements')
      .select('user_id', { count: 'exact', head: true })
      .not('user_id', 'in', excludeFilter),
    admin
      .from('analytics_events')
      .select('user_id, payload, created_at')
      .eq('event_name', 'page_viewed')
      .gte('created_at', pvCutoff)
      .order('created_at', { ascending: false })
      .range(0, 49999),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (movementsRes.error) throw movementsRes.error
  if (entriesRes.error) throw entriesRes.error
  if (pvRes.error) throw pvRes.error

  const profiles      = (profilesRes.data ?? []) as ProfileRow[]
  const movements     = (movementsRes.data ?? []) as MovementRow[]
  const entries       = (entriesRes.data ?? []) as EntryRow[]
  const recurringCount = recurringRes.count ?? 0
  // page_viewed events (filtramos founder IDs antes de agregar)
  const founderSet = new Set<string>(EXCLUDE_USER_IDS)
  const pvEvents = (pvRes.data ?? []).filter(
    (e: { user_id: string | null }) => !e.user_id || !founderSet.has(e.user_id),
  ) as PageViewEvent[]

  // ── 4. Cálculos ─────────────────────────────────────────────────────
  const now      = Date.now()
  const ms7Days  = 7  * 24 * 60 * 60 * 1000
  const ms30Days = 30 * 24 * 60 * 60 * 1000

  // CDMX "today" en YYYY-MM-DD para "movimientos hoy"
  const todayCDMX = new Date(now - 6 * 60 * 60 * 1000) // UTC-6 ~ CDMX
    .toISOString()
    .slice(0, 10)

  // Users
  const totalUsers     = profiles.length
  const newUsers7d     = profiles.filter(p => now - new Date(p.created_at).getTime() < ms7Days).length
  const activatedUsers = profiles.filter(p => (p.total_movements ?? 0) >= 1).length
  const churnedOnboard = profiles.filter(p => (p.total_movements ?? 0) === 0).length

  // Retención: movs en 3+ días distintos por usuario
  const daysByUser = new Map<string, Set<string>>()
  for (const m of movements) {
    if (!daysByUser.has(m.user_id)) daysByUser.set(m.user_id, new Set())
    daysByUser.get(m.user_id)!.add(m.movement_date)
  }
  const retainedUsers = Array.from(daysByUser.values()).filter(s => s.size >= 3).length

  // Plan distribution
  const proUsers   = profiles.filter(p => p.plan === 'pro').length
  const freeUsers  = totalUsers - proUsers
  const proActive  = profiles.filter(p => p.plan === 'pro' && p.subscription_status === 'active').length
  const trialActive = profiles.filter(p => p.subscription_status === 'trialing').length
  const mrrEstimate = proActive * PRO_PRICE_MXN

  // Movements
  const totalMovements    = movements.length
  const movementsTodayN   = movements.filter(m => m.movement_date === todayCDMX).length
  const avgMovsPerActive  = activatedUsers > 0 ? totalMovements / activatedUsers : 0

  // Time-to-first-movement: por user, primer mov.created_at - profile.created_at
  const firstMovByUser = new Map<string, number>()
  for (const m of movements) {
    const t = new Date(m.created_at).getTime()
    const cur = firstMovByUser.get(m.user_id)
    if (cur === undefined || t < cur) firstMovByUser.set(m.user_id, t)
  }
  let totalDeltaMs = 0
  let deltaCount   = 0
  for (const p of profiles) {
    const first = firstMovByUser.get(p.id)
    if (first !== undefined) {
      const delta = first - new Date(p.created_at).getTime()
      if (delta >= 0) {
        totalDeltaMs += delta
        deltaCount += 1
      }
    }
  }
  const avgHoursToFirstMov = deltaCount > 0 ? (totalDeltaMs / deltaCount) / (1000 * 60 * 60) : 0

  // Active users 7d / 30d (movement.created_at o movement_date — usamos created_at
  // para reflejar "cuándo registró el dato", no la fecha del movimiento real)
  const activeIn = (windowMs: number): number => {
    const cutoff = now - windowMs
    const active = new Set<string>()
    for (const m of movements) {
      if (new Date(m.created_at).getTime() >= cutoff) active.add(m.user_id)
    }
    return active.size
  }
  const activeUsers7d  = activeIn(ms7Days)
  const activeUsers30d = activeIn(ms30Days)

  // Input source distribution (sobre TODAS las entries, no solo último mes —
  // refleja preferencia agregada del producto)
  const inputSourceCounts: Record<string, number> = { text: 0, voice: 0, photo: 0 }
  for (const e of entries) {
    const src = (e.input_source ?? 'text').toLowerCase()
    inputSourceCounts[src] = (inputSourceCounts[src] ?? 0) + 1
  }

  // Charts: signups por día (30d)
  const signupsByDay = bucketByDay(profiles.map(p => p.created_at), 30)
  // Movements registrados por día (30d) — usa created_at (cuándo lo capturó)
  const movementsByDay = bucketByDay(movements.map(m => m.created_at), 30)

  // Tabla: últimos 20 users + lookup de último movimiento por user
  const lastMovByUser = new Map<string, string>() // user_id -> max created_at
  for (const m of movements) {
    const cur = lastMovByUser.get(m.user_id)
    if (!cur || m.created_at > cur) lastMovByUser.set(m.user_id, m.created_at)
  }
  // ── Page analytics (v0.292) ─────────────────────────────────────────
  // Window de 7 días para los KPIs principales (matchea Vercel default).
  // Trend chart cubre 30 días.
  const ms7 = 7 * 24 * 60 * 60 * 1000
  const cutoff7 = now - ms7

  const pv7d = pvEvents.filter(e => new Date(e.created_at).getTime() >= cutoff7)

  const visitors7d = new Set<string>()
  const sessions7d = new Set<string>()
  const pageViewsBySession = new Map<string, number>()
  const topPagesMap = new Map<string, Set<string>>()        // path -> visitor_ids
  const topReferrersMap = new Map<string, Set<string>>()    // domain -> visitor_ids
  const topCountriesMap = new Map<string, Set<string>>()    // country -> visitor_ids
  const devicesMap = new Map<string, Set<string>>()         // device -> visitor_ids
  const osMap      = new Map<string, Set<string>>()         // os     -> visitor_ids
  const utmSourcesMap = new Map<string, Set<string>>()      // utm_source -> visitor_ids

  for (const ev of pv7d) {
    const vid = ev.payload.visitor_id ?? `anon-${ev.created_at}`
    const sid = ev.payload.session_id ?? `anon-s-${ev.created_at}`
    visitors7d.add(vid)
    sessions7d.add(sid)
    pageViewsBySession.set(sid, (pageViewsBySession.get(sid) ?? 0) + 1)

    const path = ev.payload.path ?? '/'
    if (!topPagesMap.has(path)) topPagesMap.set(path, new Set())
    topPagesMap.get(path)!.add(vid)

    if (ev.payload.referrer) {
      try {
        const host = new URL(ev.payload.referrer).hostname.replace(/^www\./, '')
        if (!topReferrersMap.has(host)) topReferrersMap.set(host, new Set())
        topReferrersMap.get(host)!.add(vid)
      } catch {
        // ignore malformed referrers
      }
    }

    if (ev.payload.country) {
      const c = ev.payload.country
      if (!topCountriesMap.has(c)) topCountriesMap.set(c, new Set())
      topCountriesMap.get(c)!.add(vid)
    }

    if (ev.payload.device) {
      const d = ev.payload.device
      if (!devicesMap.has(d)) devicesMap.set(d, new Set())
      devicesMap.get(d)!.add(vid)
    }

    if (ev.payload.ua) {
      const os = parseOS(ev.payload.ua)
      if (!osMap.has(os)) osMap.set(os, new Set())
      osMap.get(os)!.add(vid)
    }

    if (ev.payload.utm_source) {
      const s = ev.payload.utm_source
      if (!utmSourcesMap.has(s)) utmSourcesMap.set(s, new Set())
      utmSourcesMap.get(s)!.add(vid)
    }
  }

  const totalSessions = sessions7d.size
  let bouncedSessions = 0
  for (const count of pageViewsBySession.values()) {
    if (count === 1) bouncedSessions += 1
  }
  const bounceRate = totalSessions > 0 ? bouncedSessions / totalSessions : 0

  // Trend: page_views por día últimos 30 días
  const pageViewsByDay = bucketByDay(pvEvents.map(e => e.created_at), 30)
  const visitorsByDay = bucketDistinctByDay(
    pvEvents.map(e => ({ ts: e.created_at, key: e.payload.visitor_id ?? `anon-${e.created_at}` })),
    30,
  )

  function rankSet(map: Map<string, Set<string>>, max = 8): Array<{ key: string; visitors: number }> {
    return Array.from(map.entries())
      .map(([key, set]) => ({ key, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, max)
  }

  const pageStats = {
    visitors7d:  visitors7d.size,
    pageViews7d: pv7d.length,
    sessions7d:  totalSessions,
    bounceRate,
    pageViewsByDay,
    visitorsByDay,
    topPages:     rankSet(topPagesMap),
    topReferrers: rankSet(topReferrersMap),
    topCountries: rankSet(topCountriesMap),
    devices:      rankSet(devicesMap),
    os:           rankSet(osMap),
    utmSources:   rankSet(utmSourcesMap, 6),
  }

  const recentUsers = profiles.slice(0, 20).map(p => ({
    id: p.id,
    email: p.email,
    displayName: p.display_name ?? '',
    createdAt: p.created_at,
    plan: (p.plan ?? 'free') as 'free' | 'pro',
    subscriptionStatus: p.subscription_status ?? 'none',
    totalMovements: p.total_movements ?? 0,
    lastMovementAt: lastMovByUser.get(p.id) ?? null,
    giro: p.giro ?? null,
  }))

  return (
    <AdminAnalytics
      generatedAt={new Date().toISOString()}
      kpis={{
        totalUsers, newUsers7d, activatedUsers, retainedUsers, churnedOnboard,
        proUsers, freeUsers,
        totalMovements, movementsTodayN, avgMovsPerActive, avgHoursToFirstMov,
        activeUsers7d, activeUsers30d,
        inputSourceCounts,
        proActive, trialActive, mrrEstimate,
        recurringCount,
      }}
      charts={{
        signupsByDay,
        movementsByDay,
      }}
      recentUsers={recentUsers}
      pageStats={pageStats}
    />
  )
}

// Helpers ─────────────────────────────────────────────────────────────────

function bucketByDay(timestamps: string[], days: number): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>()
  for (const ts of timestamps) {
    const day = ts.slice(0, 10) // YYYY-MM-DD
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  // Generar los últimos `days` días, llenando huecos con 0
  const out: Array<{ date: string; count: number }> = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return out
}

// Como bucketByDay pero contando distintos keys por día (visitors únicos).
function bucketDistinctByDay(
  rows: Array<{ ts: string; key: string }>,
  days: number,
): Array<{ date: string; count: number }> {
  const sets = new Map<string, Set<string>>()
  for (const r of rows) {
    const day = r.ts.slice(0, 10)
    if (!sets.has(day)) sets.set(day, new Set())
    sets.get(day)!.add(r.key)
  }
  const out: Array<{ date: string; count: number }> = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, count: sets.get(key)?.size ?? 0 })
  }
  return out
}

// Wrapper para no chocar con el alias de createAdminClient
async function createClient() {
  return await createSSRClient()
}
