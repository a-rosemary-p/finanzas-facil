import { createClient } from '@/lib/supabase/server'
import { getExtractionModel } from '@/lib/gemini/client'
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/gemini/prompts'
import { parseGeminiResponse } from '@/lib/gemini/parser'
import { PLANS } from '@/lib/constants'

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

    // 4. Llamar a Gemini para extraer movimientos
    const model = getExtractionModel()
    const prompt = `${EXTRACTION_SYSTEM_PROMPT}\n\nFecha base: ${fechaMovimiento}\n\nTexto del usuario:\n${texto.trim()}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text()

    // 5. Parsear y validar respuesta
    const movements = parseGeminiResponse(raw, fechaMovimiento)

    if (movements.length === 0) {
      return Response.json(
        { error: 'No encontré movimientos financieros en tu texto. Intenta ser más específico.' },
        { status: 422 }
      )
    }

    // 6. Devolver movimientos pendientes (NO se guardan aquí — eso es /api/entry/confirm)
    return Response.json({ movements })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    console.error('[POST /api/entry]', msg)

    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
      return Response.json(
        { error: 'El servicio de IA está saturado. Espera un momento e intenta de nuevo.' },
        { status: 429 }
      )
    }
    return Response.json(
      { error: 'Error al procesar tu texto. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
