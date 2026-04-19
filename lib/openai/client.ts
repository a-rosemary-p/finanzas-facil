import OpenAI from 'openai'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')
    _client = new OpenAI({ apiKey })
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

// Extracción de texto → devuelve string JSON
export async function extractFromText(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const client = getClient()
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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

// Extracción de imagen (vision) → devuelve string JSON
export async function extractFromImage(
  prompt: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const client = getClient()
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
                detail: 'low', // ahorra tokens en imágenes de tickets/fotos simples
              },
            },
          ],
        },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  })
}
