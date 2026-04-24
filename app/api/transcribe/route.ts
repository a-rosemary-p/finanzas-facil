/**
 * app/api/transcribe/route.ts
 *
 * Recibe un audio del cliente y lo transcribe con OpenAI Whisper.
 *
 * Migramos de webkitSpeechRecognition a MediaRecorder + Whisper porque
 * webkitSpeechRecognition en iOS Safari no liberaba el micrófono de forma
 * confiable — el Control Center mostraba "Safari is using microphone" incluso
 * después de cerrar el tab. MediaRecorder nos da control directo del
 * MediaStream: `stream.getTracks().forEach(t => t.stop())` libera el mic
 * inmediatamente, sin depender de cuando el browser decide soltarlo.
 */

import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rate-limit'
import OpenAI from 'openai'

// Whisper puede tardar hasta ~20s en audios largos. Vercel default = 10s.
export const maxDuration = 30

const MAX_AUDIO_BYTES = 26 * 1024 * 1024 // 25 MB OpenAI limit + margen JSON

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

    // Rate limit — bucket 'transcribe', 60/hr
    const rl = await consumeRateLimit(supabase, user.id, 'transcribe')
    if (!rl.ok) {
      return Response.json(
        { error: rl.message, retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // Early size guard — rechaza payloads enormes antes de bufferear
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Audio demasiado largo (máx. 25 MB)' }, { status: 413 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) {
      return Response.json({ error: 'Audio requerido' }, { status: 400 })
    }
    if (audio.size === 0) {
      return Response.json({ error: 'Audio vacío' }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Audio demasiado largo' }, { status: 413 })
    }

    const openai = new OpenAI()
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'es',
      // "text" es el response_format más barato; devuelve string plano.
      // Lo dejamos en el default ("json") para que el SDK devuelva un objeto
      // tipado y podamos sacar `.text` con TS seguro.
    })

    return Response.json({ text: transcription.text })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/transcribe]', msg)

    if (error instanceof OpenAI.APIError) {
      if (error instanceof OpenAI.RateLimitError) {
        return Response.json(
          { error: 'La IA está saturada. Espera unos segundos e intenta de nuevo.' },
          { status: 429 }
        )
      }
      if (error instanceof OpenAI.AuthenticationError) {
        console.error('[POST /api/transcribe] OpenAI auth error — API key inválida')
        return Response.json(
          { error: 'Error de configuración. Contacta al soporte.' },
          { status: 500 }
        )
      }
    }

    return Response.json(
      { error: 'No pudimos transcribir el audio. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
