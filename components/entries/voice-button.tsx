'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

// Usamos MediaRecorder + OpenAI Whisper (via /api/transcribe) en vez de
// webkitSpeechRecognition. Razón: en iOS Safari webkitSpeechRecognition
// no libera el micrófono de forma confiable aun con abort() + cleanup —
// el Control Center sigue marcando "Safari is using microphone" aún con
// el tab cerrado. MediaRecorder nos da el MediaStream directo, y
// `stream.getTracks().forEach(t => t.stop())` libera el mic YA, garantizado.
//
// Compatibilidad: MediaRecorder funciona en Chrome (desktop + Android),
// Safari (iOS 14.3+, macOS 14.1+), Edge, Firefox (✅, antes no soportaba
// webkitSpeechRecognition). Si no está disponible, el botón sale disabled.

// Duración máxima de grabación; evita que un usuario que olvida parar
// genere un audio de varios MB. 60s es suficiente para describir movimientos.
const MAX_RECORDING_MS = 60_000

function pickMimeType(): string {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return '' // dejar que el browser escoja
}

function extensionFor(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  // null = aún no hidratado (SSR)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string>('')
  const maxTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    setSupported(ok)
  }, [])

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 4000)
  }

  // Libera el MediaStream explícitamente — el paso crítico. Detiene cada
  // track, lo cual le dice al SO "ya no necesito el mic".
  function releaseStream() {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach(t => {
        try { t.stop() } catch { /* already stopped */ }
      })
    }
    streamRef.current = null
  }

  // Detiene todo: recorder, stream, timer. Idempotente.
  const hardStop = useCallback(() => {
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* ignore */ }
    }
    recorderRef.current = null
    releaseStream()
    setRecording(false)
  }, [])

  // Cleanup en unmount + en cualquier "el user se fue": mismos listeners que
  // la versión anterior, ahora aplicados al stream directo que SÍ se libera.
  useEffect(() => {
    const onPageHide = () => hardStop()
    const onVisibility = () => { if (document.visibilityState === 'hidden') hardStop() }
    const onFreeze = () => hardStop()
    const onBlur = () => hardStop()

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('freeze', onFreeze as EventListener)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('freeze', onFreeze as EventListener)
      window.removeEventListener('blur', onBlur)
      hardStop()
    }
  }, [hardStop])

  async function start() {
    setErrorMsg('')
    setRecording(false)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mime = pickMimeType()
      mimeRef.current = mime
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = rec

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      rec.onstop = async () => {
        // Liberar el mic INMEDIATAMENTE, antes de mandar a la red.
        releaseStream()
        if (maxTimerRef.current) {
          window.clearTimeout(maxTimerRef.current)
          maxTimerRef.current = null
        }
        setRecording(false)

        if (chunksRef.current.length === 0) return

        const type = mimeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []

        // Si el audio quedó muy chico (<1KB), probablemente el user tap-stop
        // demasiado rápido. Mejor no mandarlo y dar feedback suave.
        if (blob.size < 1024) {
          showError('Muy corto, intenta de nuevo')
          return
        }

        setProcessing(true)
        try {
          const ext = extensionFor(type)
          const file = new File([blob], `voice.${ext}`, { type })
          const form = new FormData()
          form.append('audio', file)

          const res = await fetchWithAuthRetry('/api/transcribe', {
            method: 'POST',
            body: form,
          })
          const data = await res.json().catch(() => null) as { text?: string; error?: string } | null

          if (!res.ok) {
            showError(data?.error || 'No pudimos transcribir')
            return
          }
          const text = data?.text?.trim() ?? ''
          if (text) {
            onTranscript(text)
          } else {
            showError('No detecté palabras. Intenta de nuevo.')
          }
        } catch {
          showError('Sin conexión. Intenta de nuevo.')
        } finally {
          setProcessing(false)
        }
      }

      rec.onerror = () => {
        showError('Error al grabar. Intenta de nuevo.')
        hardStop()
      }

      rec.start()
      setRecording(true)

      // Cap de duración — si el user olvida parar, cerramos solos.
      maxTimerRef.current = window.setTimeout(() => {
        // Chequeo defensivo por si rec ya paró.
        if (recorderRef.current?.state === 'recording') {
          try { recorderRef.current.stop() } catch { /* ignore */ }
        }
      }, MAX_RECORDING_MS)
    } catch (err) {
      // getUserMedia rechazado o dispositivo no disponible
      releaseStream()
      const name = (err as { name?: string } | null)?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showError('Permiso denegado — habilita el micrófono en tu navegador')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        showError('No se encontró micrófono en este dispositivo')
      } else if (name === 'NotReadableError') {
        showError('Micrófono en uso por otra app. Ciérrala e intenta.')
      } else {
        showError('No se pudo activar el micrófono. Intenta de nuevo.')
      }
    }
  }

  function stop() {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      // rec.stop() dispara onstop, que libera el stream y manda a transcribir
      try { rec.stop() } catch { /* already stopped */ }
    } else {
      // Edge case: recorder ya paró pero quedamos en estado recording — limpia.
      hardStop()
    }
  }

  if (supported === null) return null

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Dictado no disponible en este navegador."
        className="flex items-center justify-center rounded-xl min-h-[44px] min-w-[44px] opacity-40 cursor-not-allowed"
        style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)', color: 'var(--brand-mid)' }}
      >
        <span className="text-xl">🎤</span>
      </button>
    )
  }

  const busy = disabled || processing

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={busy}
        title={recording ? 'Detener grabación' : processing ? 'Transcribiendo…' : 'Dictar por voz'}
        className="flex items-center justify-center rounded-xl transition-all min-h-[44px] min-w-[44px]"
        style={{
          background: recording ? 'var(--danger-bg)' : 'var(--brand-chip)',
          border: `1px solid ${recording ? 'var(--danger)' : 'var(--brand)'}`,
          color: recording ? 'var(--danger)' : 'var(--brand)',
          opacity: busy && !recording ? 0.6 : 1,
        }}
      >
        {recording ? (
          <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            Grabando...
          </span>
        ) : processing ? (
          <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Transcribiendo
          </span>
        ) : (
          <span className="text-xl">🎤</span>
        )}
      </button>
      {errorMsg && (
        <p className="text-xs max-w-[160px]" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
      )}
    </div>
  )
}
