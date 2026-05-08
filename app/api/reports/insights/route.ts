/**
 * GET /api/reports/insights (v0.29 — Pro only)
 *
 * Genera análisis comparativo en lenguaje natural para la pestaña
 * "¿Cómo voy?" de /reportes. Adaptado al giro del usuario.
 *
 * Devuelve 2 insights + 1 mensaje de aliento, todo en una sola llamada
 * (v0.292: bajamos de 3 a 2 — uno general ingresos/egresos, uno de drivers
 * principales — para que ocupe menos espacio vertical en /reportes ¿Cómo voy?).
 * a gpt-4.1-mini para mantener costo bajo y latencia razonable (~3-4s).
 *
 * Caching: response headers `Cache-Control: private, max-age=3600` —
 * el browser cachea 1h por (URL exacta, sesión). Si el user va y viene
 * entre tabs sin cambiar período, no re-genera.
 *
 * Rate limit: bucket 'insights', 30/hr (suficiente para uso normal).
 *
 * Plan: Pro only. Free recibe 403 PRO_REQUIRED — la UI tiene preview
 * difuminado con CTA en lugar de llamar al endpoint.
 *
 * Query params:
 *   mode    = week | month | quarter | year
 *   anchor  = YYYY-MM-DD
 */

import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rate-limit'
import { extractFromText } from '@/lib/openai/client'
import {
  periodRange,
  prevPeriod,
  type PeriodMode,
  type PeriodSelection,
} from '@/lib/periods'

const VALID_MODES: PeriodMode[] = ['week', 'month', 'quarter', 'year']

const MODE_LABEL: Record<PeriodMode, string> = {
  week:    'esta semana',
  month:   'este mes',
  quarter: 'este trimestre',
  year:    'este año',
}
const MODE_LABEL_PREV: Record<PeriodMode, string> = {
  week:    'la semana anterior',
  month:   'el mes anterior',
  quarter: 'el trimestre anterior',
  year:    'el año anterior',
}

interface InsightsResponse {
  headline: string
  insights: string[]
  cheer: string
}

const SYSTEM_PROMPT = `Eres un analista financiero que asesora a dueños de pequeñas y medianas empresas en México. Hablas en español mexicano natural — directo, sin jerga corporativa, sin emojis, sin frases motivacionales vacías.

Tu trabajo: leer los números de un período + el período anterior + el giro del negocio, y producir análisis comparativo accionable.

REGLAS DE ESTILO:
- Frases cortas. Máximo 18 palabras por frase.
- NUNCA uses emojis.
- NUNCA inventes números — solo usa los que te paso.
- NUNCA digas "como un analista financiero..." o "según los datos...". Habla directo al dueño.
- Tono: como un amigo que sabe de números. Honesto, no condescendiente.
- Adaptado al giro: si es restaurante, habla de tickets/comidas; si es servicios profesionales, de proyectos/clientes; si es retail, de ventas/inventario.

OUTPUT: JSON válido con esta estructura exacta. EXACTAMENTE 2 insights (ni más ni menos):
{
  "headline": "Una frase principal con la lectura más importante. Incluye un número concreto comparativo.",
  "insights": [
    "Insight 1 — lectura GENERAL de ingresos y egresos del período (cómo se compararon vs el período anterior, dirección del neto, ritmo). Sin entrar a categorías individuales todavía.",
    "Insight 2 — los DRIVERS principales que movieron la aguja: qué categoría(s) de ingreso o gasto explican el cambio del período. Específico, con nombre de categoría."
  ],
  "cheer": "Frase corta de cierre, honesta. Si vas mal, no inventes optimismo. Si vas bien, reconócelo sin exageraciones."
}

Devuelve SOLO el JSON, sin markdown, sin texto adicional.`

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  // Pro gate
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, display_name, giro')
    .eq('id', user.id)
    .single()
  const plan = profile?.plan as 'free' | 'pro' | undefined
  if (plan !== 'pro') {
    return Response.json({ error: 'Insights es Pro', code: 'PRO_REQUIRED' }, { status: 403 })
  }

  // Rate limit
  const rl = await consumeRateLimit(supabase, user.id, 'insights')
  if (!rl.ok) {
    return Response.json(
      { error: rl.message, retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') as PeriodMode | null
  const anchor = searchParams.get('anchor')

  if (!mode || !VALID_MODES.includes(mode)) {
    return Response.json({ error: 'mode inválido (week|month|quarter|year)' }, { status: 400 })
  }
  if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    return Response.json({ error: 'anchor inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const period: PeriodSelection = { mode, anchor }
  const previous = prevPeriod(period)
  const currentRange = periodRange(period)
  const previousRange = periodRange(previous)

  // Cubrir ambos rangos en una query
  const { data: rows, error: dbError } = await supabase
    .from('movements')
    .select('type, amount, category, movement_date, is_investment')
    .eq('user_id', user.id)
    .gte('movement_date', previousRange.start)
    .lte('movement_date', currentRange.end)
    .in('type', ['ingreso', 'gasto'])

  if (dbError) {
    console.error('[GET /api/reports/insights] db error', dbError)
    return Response.json({ error: 'Error al cargar datos' }, { status: 500 })
  }

  type Row = { type: string; amount: number; category: string; movement_date: string; is_investment: boolean | null }
  const movs = (rows ?? []).map((r): Row => ({
    type: r['type'] as string,
    amount: Number(r['amount']),
    category: r['category'] as string,
    movement_date: r['movement_date'] as string,
    is_investment: (r['is_investment'] as boolean | null) ?? false,
  }))

  const inCurrent = movs.filter(m => m.movement_date >= currentRange.start && m.movement_date <= currentRange.end && !m.is_investment)
  const inPrevious = movs.filter(m => m.movement_date >= previousRange.start && m.movement_date <= previousRange.end && !m.is_investment)

  const cur = aggregate(inCurrent)
  const prev = aggregate(inPrevious)

  // Sin datos en ninguno de los dos períodos → respuesta vacía sin pegar al LLM
  if (cur.income === 0 && cur.expenses === 0 && prev.income === 0 && prev.expenses === 0) {
    return Response.json({
      headline: 'Sin movimientos suficientes para comparar todavía.',
      insights: [
        'Empieza a registrar lo que pasa en tu negocio cada día.',
        'Cuando tengas datos en este período y el anterior, este análisis se llena solo.',
      ],
      cheer: 'Vas a llegar — un movimiento a la vez.',
    } satisfies InsightsResponse, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  }

  // ── Construir prompt ────────────────────────────────────────────────────
  const giro = (profile?.giro as string | null) ?? 'negocio general'
  const userPrompt = buildUserPrompt(mode, giro, cur, prev)

  let raw: string
  try {
    raw = await extractFromText(SYSTEM_PROMPT, userPrompt)
  } catch (err) {
    console.error('[GET /api/reports/insights] LLM error', err)
    return Response.json({ error: 'No se pudo generar el análisis. Intenta de nuevo.' }, { status: 500 })
  }

  // Parse — gpt-4.1-mini con response_format=json_object SIEMPRE devuelve JSON válido
  let parsed: InsightsResponse
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    parsed = {
      headline: typeof obj['headline'] === 'string' ? obj['headline'] as string : '',
      insights: Array.isArray(obj['insights'])
        ? (obj['insights'] as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 2)
        : [],
      cheer: typeof obj['cheer'] === 'string' ? obj['cheer'] as string : '',
    }
  } catch (err) {
    console.error('[GET /api/reports/insights] parse error', err, raw)
    return Response.json({ error: 'Análisis con formato inesperado. Intenta de nuevo.' }, { status: 500 })
  }

  return Response.json(parsed, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────

interface AggregateResult {
  income: number
  expenses: number
  net: number
  byCategory: Record<string, { income: number; expenses: number }>
}

function aggregate(movs: Array<{ type: string; amount: number; category: string }>): AggregateResult {
  let income = 0
  let expenses = 0
  const byCategory: Record<string, { income: number; expenses: number }> = {}

  for (const m of movs) {
    if (!byCategory[m.category]) byCategory[m.category] = { income: 0, expenses: 0 }
    if (m.type === 'ingreso') {
      income += m.amount
      byCategory[m.category].income += m.amount
    } else if (m.type === 'gasto') {
      expenses += m.amount
      byCategory[m.category].expenses += m.amount
    }
  }
  return { income, expenses, net: income - expenses, byCategory }
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

function buildUserPrompt(
  mode: PeriodMode,
  giro: string,
  cur: AggregateResult,
  prev: AggregateResult,
): string {
  const lines: string[] = []
  lines.push(`Giro del negocio: ${giro}`)
  lines.push('')
  lines.push(`Período actual (${MODE_LABEL[mode]}):`)
  lines.push(`  Ingresos: ${fmt(cur.income)}`)
  lines.push(`  Gastos:   ${fmt(cur.expenses)}`)
  lines.push(`  Neto:     ${fmt(cur.net)} (${cur.income > 0 ? Math.round((cur.net / cur.income) * 100) : 0}% margen)`)
  if (Object.keys(cur.byCategory).length > 0) {
    lines.push('  Por categoría (top 5):')
    const top = Object.entries(cur.byCategory)
      .map(([cat, v]) => ({ cat, total: v.income + v.expenses, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
    for (const t of top) {
      const isIncome = t.income > t.expenses
      lines.push(`    ${t.cat}: ${isIncome ? 'ingresos' : 'gastos'} ${fmt(isIncome ? t.income : t.expenses)}`)
    }
  }
  lines.push('')
  lines.push(`${MODE_LABEL_PREV[mode]} (mismo período del calendario anterior):`)
  lines.push(`  Ingresos: ${fmt(prev.income)}`)
  lines.push(`  Gastos:   ${fmt(prev.expenses)}`)
  lines.push(`  Neto:     ${fmt(prev.net)}`)

  // Variaciones para que el modelo no tenga que calcularlas
  lines.push('')
  lines.push('Variaciones:')
  if (prev.income > 0) {
    const pct = Math.round(((cur.income - prev.income) / prev.income) * 100)
    lines.push(`  Ingresos ${pct >= 0 ? '+' : ''}${pct}% (${fmt(cur.income - prev.income)})`)
  }
  if (prev.expenses > 0) {
    const pct = Math.round(((cur.expenses - prev.expenses) / prev.expenses) * 100)
    lines.push(`  Gastos ${pct >= 0 ? '+' : ''}${pct}% (${fmt(cur.expenses - prev.expenses)})`)
  }
  if (Math.abs(prev.net) > 0) {
    const pct = Math.round(((cur.net - prev.net) / Math.abs(prev.net)) * 100)
    lines.push(`  Neto ${pct >= 0 ? '+' : ''}${pct}% (${fmt(cur.net - prev.net)})`)
  }

  lines.push('')
  lines.push('Genera el JSON con headline + 3 insights + cheer, adaptado al giro y los números arriba.')

  return lines.join('\n')
}
