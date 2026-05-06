import { createClient } from '@/lib/supabase/server'
import { extractTextFromImage, extractFromText, extractFromImage, extractFromPdf } from '@/lib/openai/client'
import { OCR_TRANSCRIPTION_PROMPT, buildPhotoExtractionPrompt, buildExtractionSystemPrompt } from '@/lib/ai/prompts'
import { getCategoriesForGiro, buildCategoriesSection } from '@/lib/giro-categories'
import { parseGeminiResponse } from '@/lib/ai/parser'
import { PLANS, PHOTO_LIMITS, OCR_MIN_TEXT_LENGTH } from '@/lib/constants'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getAppToday } from '@/lib/cdmx-date'
import { trackServer } from '@/lib/analytics-server'
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

    // 1.25. Rate limit (bucket "entry_photo", 30/hr). Foto es más cara que
    // texto (GPT-4o vision) — límite más estricto.
    const rl = await consumeRateLimit(supabase, user.id, 'entry_photo')
    if (!rl.ok) {
      return Response.json(
        { error: rl.message, retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // 1.5. Early Content-Length guard — rechazamos payloads enormes ANTES de
    // bufferear el body completo. PDFs van hasta 10 MB → ~13.7 MB en base64;
    // dejamos 14 MB de holgura para JSON overhead.
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 14 * 1024 * 1024) {
      return Response.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })
    }

    // 2. Validar input
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }
    const { base64, mimeType, fechaMovimiento } = body as Record<string, unknown>

    if (typeof base64 !== 'string' || base64.length === 0) {
      return Response.json({ error: 'Archivo no válido' }, { status: 400 })
    }

    const validMime = (PHOTO_LIMITS.acceptedFormats as readonly string[]).includes(mimeType as string)
    if (!validMime) {
      return Response.json({ error: 'Formato no soportado. Usa JPG, PNG, WebP o PDF.' }, { status: 400 })
    }

    const isPdf = mimeType === 'application/pdf'

    // Validar tamaño (base64 ~= 1.37x tamaño real). Límites distintos:
    // PDFs hasta 10 MB (multi-página); imágenes hasta 5 MB.
    const approxSizeMB = (base64.length * 3) / (4 * 1024 * 1024)
    const limitMB = isPdf ? PHOTO_LIMITS.pdfMaxFileSizeMB : PHOTO_LIMITS.maxFileSizeMB
    if (approxSizeMB > limitMB) {
      return Response.json(
        { error: `El archivo es demasiado grande (máx. ${limitMB} MB).` },
        { status: 400 }
      )
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof fechaMovimiento !== 'string' || !dateRegex.test(fechaMovimiento)) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    // 3. Verificar límite del plan Free + leer giro para categorías
    //    personalizadas en el prompt (v0.292).
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, movements_today, movements_today_date, giro')
      .eq('id', user.id)
      .single()

    if (profile?.plan === 'free') {
      const today = getAppToday()
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
    // Para imágenes (jpg/png/webp): pipeline de 2 pasos
    //   Paso 1: gpt-4o con detail:high → texto crudo sin interpretar
    //   Paso 2a (happy path): gpt-4.1-mini parsea el texto a JSON (más barato)
    //   Paso 2b (fallback): si OCR falló, gpt-4o vision directa con prompt de extracción
    //
    // Para PDFs: una sola llamada con extractFromPdf
    //   gpt-4o acepta PDFs como input nativo y maneja texto + escaneos internamente.
    //   No tiene sentido el pipeline OCR-first porque el modelo ya hace ambos
    //   internamente en una sola pasada. El input nativo cuesta lo mismo que una
    //   imagen detail:high por página (la mayoría de tickets/facturas son 1-3 págs).
    // ─────────────────────────────────────────────────────────────────────────────

    // Categorías personalizadas según el giro del user (o genéricas).
    const cats = getCategoriesForGiro(profile?.giro as string | null | undefined)
    const categoriesSection = buildCategoriesSection(cats)
    const photoPromptBase = buildPhotoExtractionPrompt(categoriesSection)
    const textPromptBase  = buildExtractionSystemPrompt(categoriesSection)

    let movements: PendingMovement[] = []

    if (isPdf) {
      // ── Path PDF: extracción en una sola llamada ───────────────────────────
      const prompt = `${photoPromptBase}\n\nFecha base: ${fecha}`
      const raw = await extractFromPdf(prompt, b64, 'documento.pdf')
      movements = parseGeminiResponse(raw, fecha)
    } else {
      // ── Path imagen: OCR → texto → JSON, con fallback a visión directa ─────
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
        const userContent = [
          `Fecha base: ${fecha}`,
          '',
          'Texto extraído de la imagen:',
          ocrText,
        ].join('\n')

        const raw = await extractFromText(textPromptBase, userContent)
        movements = parseGeminiResponse(raw, fecha)
      }

      // Si el OCR falló o no se encontraron movimientos → fallback visión directa
      if (movements.length === 0) {
        const prompt = `${photoPromptBase}\n\nFecha base: ${fecha}`
        const raw = await extractFromImage(prompt, b64, mime)
        movements = parseGeminiResponse(raw, fecha)
      }
    }

    if (movements.length === 0) {
      const detail = isPdf
        ? 'No encontré movimientos financieros en el PDF. Intenta con otro documento.'
        : 'No encontré movimientos financieros en la imagen. Intenta con otra foto más clara.'
      return Response.json({ error: detail }, { status: 422 })
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
