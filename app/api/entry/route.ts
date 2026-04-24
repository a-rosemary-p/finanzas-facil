import { createClient } from '@/lib/supabase/server'
import { extractFromText } from '@/lib/openai/client'
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { parseGeminiResponse } from '@/lib/ai/parser'
import { PLANS } from '@/lib/constants'
import { consumeRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 1.5. Rate limit (bucket "entry", 100/hr). Se consume ANTES de leer el
    // body o hablar con OpenAI — protege contra abuso automatizado.
    const rl = await consumeRateLimit(supabase, user.id, 'entry')
    if (!rl.ok) {
      return Response.json(
        { error: rl.message, retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // 2. Validar input
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { texto, fechaMovimiento } = body as Record<string, unknown>

    if (typeof texto !== 'string' || texto.trim().length === 0) {
      return Response.json({ error: 'El texto no puede estar vacío' }, { status: 400 })
    }
    if (texto.trim().length > 1000) {
      return Response.json({ error: 'El texto es demasiado largo (máx. 1000 caracteres)' }, { status: 400 })
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof fechaMovimiento !== 'string' || !dateRegex.test(fechaMovimiento)) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    // 3. Verificar límite del plan Free ANTES de llamar a Gemini
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, movements_today, movements_today_date')
      .eq('id', user.id)
      .single()

    if (profile && profile.plan === 'free') {
      // Si movements_today_date es de hoy, revisar contador
      const today = new Date().toISOString().split('T')[0]
      const isToday = profile.movements_today_date === today
      const usedToday = isToday ? (profile.movements_today as number) : 0

      if (usedToday >= PLANS.FREE.maxMovementsPerDay) {
        return Response.json(
          {
            error: 'LIMIT_EXCEEDED',
            message: `Alcanzaste el límite de ${PLANS.FREE.maxMovementsPerDay} movimientos del día en el plan Free.`,
            usedToday,
            limit: PLANS.FREE.maxMovementsPerDay,
          },
          { status: 429 }
        )
      }
    }

    // 4. Llamar a OpenAI para extraer movimientos
    const userContent = `Fecha base: ${fechaMovimiento}\n\nTexto del usuario:\n${texto.trim()}`
    const raw = await extractFromText(EXTRACTION_SYSTEM_PROMPT, userContent)

    // 5. Parsear y validar respuesta
    const movements = parseGeminiResponse(raw, fechaMovimiento)

    if (movements.length === 0) {
      // Intentar dar una pista según lo que falta en el texto
      const t = texto.trim().toLowerCase()
      let hint = 'Incluye el monto, si fue venta o gasto, y qué fue.'
      if (!/\d/.test(t)) hint = 'No encontré ningún monto. Escribe la cantidad, ej: "vendí 500" o "gasté 200".'
      else if (!/(vendí|cobré|entró|ingresé|gasté|pagué|compré|salió|debo|me deben)/.test(t))
        hint = 'No queda claro si fue venta o gasto. Ej: "vendí 500 en tacos" o "gasté 300 en aceite".'
      return Response.json(
        { error: `No encontré movimientos financieros. ${hint}` },
        { status: 422 }
      )
    }

    // 6. Devolver movimientos pendientes (NO se guardan aquí — eso es /api/entry/confirm)
    return Response.json({ movements })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/entry]', msg)

    // Usar las clases tipadas del SDK de OpenAI en lugar de string matching
    // sobre err.message — más robusto ante cambios en el wording de OpenAI.
    const { default: OpenAI } = await import('openai')
    if (error instanceof OpenAI.APIError) {
      if (error instanceof OpenAI.RateLimitError) {
        return Response.json(
          { error: 'La IA está saturada. Espera unos segundos e intenta de nuevo.' },
          { status: 429 }
        )
      }
      if (error instanceof OpenAI.AuthenticationError) {
        console.error('[POST /api/entry] OpenAI auth error — API key inválida o caducada')
        return Response.json(
          { error: 'Error de configuración del servicio. Contacta al soporte.' },
          { status: 500 }
        )
      }
      if (error instanceof OpenAI.APIConnectionTimeoutError || error.status === 504) {
        return Response.json(
          { error: 'La IA tardó demasiado. Intenta con un texto más corto.' },
          { status: 504 }
        )
      }
    }

    // Errores nuestros de parseo (no de OpenAI) vienen como mensajes genéricos
    if (msg.includes('JSON') || msg.includes('Formato') || msg.includes('No se encontró JSON')) {
      return Response.json(
        { error: 'La IA respondió de forma inesperada. Intenta de nuevo.' },
        { status: 500 }
      )
    }
    return Response.json(
      { error: 'Error al procesar tu texto. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
