import { createClient } from '@/lib/supabase/server'
import { extractTextFromImage, extractFromText, extractFromImage } from '@/lib/openai/client'
import { OCR_TRANSCRIPTION_PROMPT, PHOTO_EXTRACTION_PROMPT, EXTRACTION_SYSTEM_PROMPT } from '@/lib/gemini/prompts'
import { parseGeminiResponse } from '@/lib/gemini/parser'
import { PLANS, PHOTO_LIMITS, OCR_MIN_TEXT_LENGTH } from '@/lib/constants'
import type { PendingMovement } from '@/types'

// Vercel Pro permite hasta 60s — el pipeline OCR+parse puede tardar ~25s en imágenes complejas
export const maxDuration = 60

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

    const b64 = base64 as string
    const mime = mimeType as string
    const fecha = fechaMovimiento as string

    // ─── Pipeline OCR + LLM ──────────────────────────────────────────────────────
    //
    // Paso 1: Transcripción OCR
    //   gpt-4o con detail:high → extrae texto crudo sin interpretar
    //
    // Paso 2a (happy path): si OCR extrajo suficiente texto
    //   gpt-4.1-mini (texto puro, sin visión) → más rápido y barato
    //
    // Paso 2b (fallback): si OCR falló (imagen borrosa, sin texto, etc.)
    //   gpt-4o vision con detail:high + prompt completo → misma calidad pero más caro
    // ─────────────────────────────────────────────────────────────────────────────

    let movements: PendingMovement[] = []

    // Paso 1: OCR
    let ocrText = ''
    try {
      ocrText = await extractTextFromImage(OCR_TRANSCRIPTION_PROMPT, b64, mime)
    } catch {
      // Si OCR falla, continuamos directo al fallback de visión
      ocrText = ''
    }

    const ocrSucceeded =
      ocrText.length >= OCR_MIN_TEXT_LENGTH &&
      !ocrText.includes('[SIN TEXTO]')

    if (ocrSucceeded) {
      // Paso 2a: texto extraído → modelo de texto (sin visión)
      const userContent = [
        `Fecha base: ${fecha}`,
        '',
        'Texto extraído de la imagen:',
        ocrText,
      ].join('\n')

      const raw = await extractFromText(EXTRACTION_SYSTEM_PROMPT, userContent)
      movements = parseGeminiResponse(raw, fecha)
    }

    // Si el OCR falló o no se encontraron movimientos → fallback visión directa
    if (movements.length === 0) {
      const prompt = `${PHOTO_EXTRACTION_PROMPT}\n\nFecha base: ${fecha}`
      const raw = await extractFromImage(prompt, b64, mime)
      movements = parseGeminiResponse(raw, fecha)
    }

    if (movements.length === 0) {
      return Response.json(
        { error: 'No encontré movimientos financieros en la imagen. Intenta con otra foto más clara.' },
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
        { error: 'La IA tardó demasiado analizando la imagen. Intenta con una foto más clara y enfocada.' },
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
