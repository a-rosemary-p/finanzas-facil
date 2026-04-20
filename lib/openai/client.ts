import OpenAI from 'openai'
import { AI_MODEL, VISION_MODEL } from '@/lib/constants'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')
    _client = new OpenAI({
      apiKey,
      timeout: 30_000, // 30s — acomoda el paso OCR con detail:high
    })
  }
  return _client
}

// Reintenta hasta 3 veces en errores 429 con backoff lineal
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.includes('rate_limit') ||
          err.message.includes('quota'))
      if (!isRateLimit || attempt === 2) throw err
      // 1.2s → 2.4s entre reintentos
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1)))
    }
  }
  throw lastErr
}

// ─── Paso 1 del pipeline OCR+LLM ──────────────────────────────────────────────
// Transcripción cruda de texto en imagen.
// Usa gpt-4o con detail:high para máxima legibilidad.
// Devuelve texto plano (no JSON) — puede incluir "[SIN TEXTO]" si no hay contenido.
export async function extractTextFromImage(
  ocrPrompt: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const client = getClient()
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ocrPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high', // necesario para leer texto — 'low' procesa a 512×512
              },
            },
          ],
        },
      ],
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  })
}

// ─── Paso 2: parseo estructurado de texto (sin visión) ────────────────────────
// Toma el texto OCR limpio y lo convierte a movimientos JSON.
// Modelo barato (AI_MODEL) — el trabajo duro ya lo hizo el paso OCR.
export async function extractFromText(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const client = getClient()
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  })
}

// ─── Fallback: visión directa (si OCR no extrajo texto suficiente) ────────────
// Usa gpt-4o con detail:high + prompt completo de extracción.
// Más caro pero necesario cuando la imagen no tiene texto claro (foto borrosa, etc).
export async function extractFromImage(
  prompt: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const client = getClient()
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  })
}
