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
      // Centralizamos TODA la lógica de retry en `withRetry` (abajo) para
      // tener control sobre backoff, Retry-After y la distinción
      // rate_limit_exceeded vs insufficient_quota. Apagamos los reintentos
      // internos del SDK para no duplicar backoffs anidados.
      maxRetries: 0,
    })
  }
  return _client
}

/**
 * Reintenta llamadas a OpenAI ante errores transitorios.
 *
 * Distingue dos tipos de HTTP 429 que el SDK colapsa en `RateLimitError`:
 *   - `rate_limit_exceeded` (RPM/TPM del tier) → TRANSITORIO. Esperar ayuda.
 *     Reintenta con backoff exponencial, respetando el header `Retry-After`
 *     si OpenAI lo manda.
 *   - `insufficient_quota` (saldo/cuota de la cuenta agotada) → NO transitorio.
 *     Esperar NO ayuda. Rethrow inmediato + log claro para debug.
 *
 * También reintenta 5xx transitorios (500/502/503/504). Cualquier otro error
 * (4xx de validación, auth, parseo) se relanza sin reintentar.
 *
 * Nota sobre el bug "La IA está saturada" (testing jun 2026): el 429 NO es por
 * falta de crédito — es el RPM/TPM del usage tier de OpenAI. Subir de tier
 * (lifetime spend) sube esos límites. Ver Fiza_CHANGELOG.md v1.0.6.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 4
  let lastErr: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err

      // 429 rate limit (RPM/TPM) — transitorio, reintentar.
      if (err instanceof OpenAI.RateLimitError) {
        // insufficient_quota = saldo agotado. Reintentar es inútil.
        if (err.code === 'insufficient_quota') {
          console.error('[openai] insufficient_quota — saldo/cuota agotada, revisar billing. NO se reintenta.')
          throw err
        }
        if (attempt === MAX_ATTEMPTS - 1) {
          console.error(`[openai] rate_limit_exceeded (RPM/TPM del tier) tras ${MAX_ATTEMPTS} intentos`)
          throw err
        }
        // Respetar Retry-After (segundos) si viene; si no, backoff exponencial.
        // `err.headers` es un objeto Headers (Fetch API) — usar .get().
        const retryAfterRaw = err.headers?.get('retry-after')
        const retryAfterSec = retryAfterRaw ? Number(retryAfterRaw) : NaN
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, 8000) // cap 8s para no colgar la request
          : 1000 * 2 ** attempt // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      // 5xx transitorios — reintento rápido.
      if (
        err instanceof OpenAI.APIError &&
        (err.status === 500 || err.status === 502 || err.status === 503 || err.status === 504)
      ) {
        if (attempt === MAX_ATTEMPTS - 1) throw err
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
        continue
      }

      // Cualquier otro error no es recuperable reintentando.
      throw err
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

// ─── Extracción desde PDF ─────────────────────────────────────────────────────
// OpenAI gpt-4o acepta PDFs como input nativo (file content type) — maneja
// internamente texto + imágenes/escaneos y devuelve directo el JSON estructurado.
// No tiene sentido el pipeline de 2 pasos (OCR → texto) porque el modelo ya hace
// las dos cosas en una sola llamada para PDFs.
//
// Costo: cada página del PDF se procesa equivalente a una imagen detail:high.
// Para tickets/facturas (1-3 páginas) es comparable al costo de una foto.
export async function extractFromPdf(
  prompt: string,
  base64: string,
  filename: string
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
              type: 'file',
              file: {
                file_data: `data:application/pdf;base64,${base64}`,
                filename,
              },
            },
          ],
        },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  })
}
