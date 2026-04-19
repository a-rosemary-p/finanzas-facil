import { createClient } from '@/lib/supabase/server'
import { extractFromImage } from '@/lib/openai/client'
import { PHOTO_EXTRACTION_PROMPT } from '@/lib/gemini/prompts'
import { parseGeminiResponse } from '@/lib/gemini/parser'
import { PLANS, PHOTO_LIMITS } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Validar input
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { base64, mimeType, fechaMovimiento } = body as Record<string, unknown>

    if (typeof base64 !== 'string' || base64.length === 0) {
      return Response.json({ error: 'Imagen no válida' }, { status: 400 })
    }

    // Validar tamaño (base64 ~= 1.37x tamaño real)
    const approxSizeMB = (base64.length * 3) / (4 * 1024 * 1024)
    if (approxSizeMB > PHOTO_LIMITS.maxFileSizeMB) {
      return Response.json({ error: 'La imagen es demasiado grande (máx. 5 MB)' }, { status: 400 })
    }

    const validMime = (PHOTO_LIMITS.acceptedFormats as readonly string[]).includes(mimeType as string)
    if (!validMime) {
      return Response.json({ error: 'Formato de imagen no soportado' }, { status: 400 })
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof fechaMovimiento !== 'string' || !dateRegex.test(fechaMovimiento)) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    // 3. Verificar límite del plan Free
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, movements_today, movements_today_date')
      .eq('id', user.id)
      .single()

    if (profile?.plan === 'free') {
      const today = new Date().toISOString().split('T')[0]
      const isToday = profile.movements_today_date === today
      const usedToday = isToday ? (profile.movements_today as number) : 0

      if (usedToday >= PLANS.FREE.maxMovementsPerDay) {
        return Response.json(
          {
            error: 'LIMIT_EXCEEDED',
            message: `Alcanzaste el límite de ${PLANS.FREE.maxMovementsPerDay} movimientos del día en el plan Free.`,
          },
          { status: 429 }
        )
      }
    }

    // 4. Llamar a OpenAI Vision (multimodal)
    const prompt = `${PHOTO_EXTRACTION_PROMPT}\n\nFecha base: ${fechaMovimiento}`
    const raw = await extractFromImage(prompt, base64 as string, mimeType as string)

    // 5. Parsear y validar respuesta
    const movements = parseGeminiResponse(raw, fechaMovimiento)

    if (movements.length === 0) {
      return Response.json(
        { error: 'No encontré movimientos financieros en la imagen. Intenta con otra foto.' },
        { status: 422 }
      )
    }

    return Response.json({ movements })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/entry/photo]', msg)

    if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
      return Response.json(
        { error: 'La IA está saturada. Espera unos segundos e intenta de nuevo.' },
        { status: 429 }
      )
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('ETIMEDOUT')) {
      return Response.json(
        { error: 'La IA tardó demasiado analizando la imagen. Intenta con una foto más sencilla.' },
        { status: 504 }
      )
    }
    if (msg.includes('JSON') || msg.includes('Formato') || msg.includes('No se encontró JSON')) {
      return Response.json(
        { error: 'La IA no pudo interpretar la imagen. Intenta de nuevo.' },
        { status: 500 }
      )
    }
    if (msg.includes('OPENAI_API_KEY') || msg.includes('authentication') || msg.includes('api_key')) {
      console.error('[POST /api/entry/photo] Error de configuración de API key')
      return Response.json(
        { error: 'Error de configuración del servicio. Contacta al soporte.' },
        { status: 500 }
      )
    }
    return Response.json(
      { error: 'Error al analizar la imagen. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
