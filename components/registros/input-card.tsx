'use client'

/**
 * InputCard — la zona de captura en /registros (rediseño abr 2026).
 *
 * Tres "botones gordos" como entry points al flujo:
 *   - Foto:     abre file picker (cámara nativa en mobile / archivo en desktop),
 *               procesa con OCR + LLM, va directo a confirmation. Autónomo.
 *   - Dictar:   inicia grabación. Tap de nuevo para parar. Transcribe con
 *               Whisper, manda el texto a /api/entry, va directo a confirmation.
 *               Timer visible mm:ss durante la grabación. Cap 60s (igualito que
 *               la versión vieja del voice button).
 *   - Escribir: expande textarea + selector de fecha. User edita, toca el botón
 *               Registrar al fondo del card.
 *
 * Diferencia con la versión vieja (`EntryForm`):
 *   - Antes los 3 modos coexistían: textarea siempre visible, botones de voz/foto
 *     al lado. La voz APENDIZABA al textarea (el user editaba antes de mandar).
 *   - Ahora cada modo es un camino separado: voz/foto van directos al pipeline,
 *     escribir es el camino "longform".
 *   - Esta UX es más rápida para los caminos comunes (foto de ticket, "vendí
 *     2,000 hoy"); para casos complicados, "Escribir" sigue ahí.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { getTodayString } from '@/lib/utils'
import { processImage } from '@/lib/image-utils'
import { PHOTO_LIMITS } from '@/lib/constants'
import {
  IconChatText, IconCamera, IconMicrophone, IconPencil,
  IconArrowRight, IconCalendar,
} from '@/components/icons'
import type { PendingMovement } from '@/types'

const MAX_RECORDING_MS = 60_000

interface PendingData {
  rawText: string
  entryDate: string
  movements: PendingMovement[]
}

interface Props {
  onMovementsExtracted: (data: PendingData) => void
}

type Mode = 'foto' | 'dictar' | 'escribir' | null

export function InputCard({ onMovementsExtracted }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [text, setText] = useState('')
  const [fecha, setFecha] = useState(getTodayString())
  const [error, setError] = useState('')

  // Loadings — solo uno activo a la vez.
  const [photoLoading,  setPhotoLoading]  = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [transcribing,  setTranscribing]  = useState(false)
  // recording vive en useRecorder (mantiene refs)
  const recorder = useRecorder()

  const busy =
    photoLoading || submitting || transcribing || recorder.isRecording

  // ── FOTO ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  function openPhotoPicker() {
    if (busy) return
    setError('')
    fileInputRef.current?.click()
  }
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!PHOTO_LIMITS.acceptedFormats.includes(file.type as typeof PHOTO_LIMITS.acceptedFormats[number])) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > PHOTO_LIMITS.maxFileSizeMB * 1024 * 1024 * 3) {
      setError('La imagen es demasiado grande.')
      return
    }

    setPhotoLoading(true)
    try {
      const { base64, mimeType } = await processImage(file)
      const res = await fetchWithAuthRetry('/api/entry/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType, fechaMovimiento: getTodayString() }),
      })
      const data = await res.json() as { movements?: PendingMovement[]; error?: string; message?: string }
      if (!res.ok) {
        setError(data.message || data.error || 'Error al analizar la imagen.')
        return
      }
      onMovementsExtracted({
        rawText: 'Imagen analizada con IA',
        entryDate: getTodayString(),
        movements: data.movements ?? [],
      })
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.')
    } finally {
      setPhotoLoading(false)
    }
  }

  // ── DICTAR ──────────────────────────────────────────────────────────────
  async function toggleRecording() {
    if (busy && !recorder.isRecording) return
    setError('')
    if (recorder.isRecording) {
      // Parar → onStop dispara la transcripción
      recorder.stop()
      return
    }
    const r = await recorder.start()
    if (r.error) setError(r.error)
  }

  // Cuando termina la grabación, recorder llama onResult con el texto.
  // Lo mandamos directo al pipeline LLM como si fuera un /api/entry de texto.
  useEffect(() => {
    return recorder.onResult(async (transcript) => {
      if (!transcript.trim()) {
        setError('No detecté palabras. Intenta de nuevo.')
        return
      }
      setTranscribing(false) // recorder ya completó la transcripción
      await submitText(transcript, getTodayString())
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recorder también nos avisa cuando empieza a transcribir (después de stop).
  useEffect(() => {
    return recorder.onPhase((phase) => {
      setTranscribing(phase === 'transcribing')
      if (phase === 'error' && recorder.errorMsg) setError(recorder.errorMsg)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── ESCRIBIR ─────────────────────────────────────────────────────────────
  async function submitText(rawText: string, entryDate: string) {
    setSubmitting(true)
    try {
      const res = await fetchWithAuthRetry('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: rawText.trim(), fechaMovimiento: entryDate }),
      })
      const data = await res.json() as {
        movements?: PendingMovement[]; error?: string; message?: string;
      }
      if (!res.ok) {
        if (res.status === 429) setError('La IA está saturada. Espera unos segundos e intenta.')
        else if (res.status === 504) setError('La IA tardó demasiado. Intenta con un texto más corto.')
        else if (res.status === 422) setError(data.error || 'No encontré movimientos en ese texto.')
        else setError(data.message || data.error || 'Error al procesar.')
        return
      }
      onMovementsExtracted({
        rawText: rawText.trim(),
        entryDate,
        movements: data.movements ?? [],
      })
      setText('')
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleEscribirSubmit() {
    if (!text.trim() || busy) return
    void submitText(text, fecha)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const escribirOpen = mode === 'escribir'

  return (
    <div
      className="rounded-2xl bg-white p-3.5"
      style={{ border: '1px solid var(--brand-border)', boxShadow: 'var(--sh-2)', overflow: 'hidden' }}
    >
      {/* Header: ¿Qué pasó hoy en tu negocio? */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--brand-muted)' }}>
          <IconChatText size={18} />
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--ink-900)' }}>
          ¿Qué pasó hoy en tu negocio?
        </span>
      </div>

      {/* 3 botones */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <div
        className="grid grid-cols-3 gap-2"
        style={{ marginBottom: escribirOpen ? 12 : 0 }}
      >
        <CaptureButton
          variant="filled"
          icon={<IconCamera size={28} />}
          label={photoLoading ? 'Analizando…' : 'Foto'}
          hint="Recibos y facturas"
          active={photoLoading}
          disabled={busy && !photoLoading}
          onClick={openPhotoPicker}
        />
        <CaptureButton
          variant="filled"
          icon={<IconMicrophone size={28} />}
          label={
            recorder.isRecording
              ? formatRecordingTimer(recorder.elapsedMs)
              : transcribing
              ? 'Transcribiendo…'
              : 'Dictar'
          }
          hint={recorder.isRecording ? '' : 'Cuéntame qué pasó'}
          active={recorder.isRecording || transcribing}
          disabled={(busy && !recorder.isRecording && !transcribing) || !recorder.supported}
          onClick={toggleRecording}
        />
        <CaptureButton
          variant="outlined"
          icon={<IconPencil size={28} />}
          label="Escribir"
          hint="Texto libre"
          active={escribirOpen}
          disabled={busy}
          onClick={() => setMode(m => m === 'escribir' ? null : 'escribir')}
        />
      </div>

      {/* Textarea expandible (Escribir) */}
      <div
        style={{
          maxHeight: escribirOpen ? 220 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Ej: cobré $8,500 del proyecto del cliente, $1,200 fue de comisiones."
          disabled={busy}
          className="w-full rounded-xl text-sm focus:outline-none focus:ring-1"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--brand-border)',
            color: 'var(--ink-900)',
            padding: '10px 12px',
            marginTop: 4,
            resize: 'none',
          }}
        />
      </div>

      {/* Fecha expandible (Escribir) */}
      <div
        style={{
          maxHeight: escribirOpen ? 80 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        <div className="mt-2.5">
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-500)' }}>
            ¿Cuándo ocurrió?
          </div>
          <label
            className="flex items-center justify-between rounded-xl"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--brand-border)',
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="date"
              value={fecha}
              max={getTodayString()}
              onChange={e => setFecha(e.target.value)}
              disabled={busy}
              className="text-sm font-medium bg-transparent focus:outline-none flex-1 min-w-0"
              style={{ color: 'var(--ink-700)' }}
            />
            <span style={{ color: 'var(--brand-muted)' }}>
              <IconCalendar size={20} />
            </span>
          </label>
        </div>
      </div>

      {/* Error inline */}
      {error && (
        <p className="text-xs mt-2.5" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {/* Botón Registrar — solo cuando Escribir está abierto */}
      {escribirOpen && (
        <button
          type="button"
          onClick={handleEscribirSubmit}
          disabled={busy || !text.trim()}
          className="w-full rounded-xl text-white text-sm font-bold mt-3 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: 'var(--brand-mid)',
            minHeight: 44,
            boxShadow: '0 4px 14px rgba(107,140,120,0.28)',
          }}
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Procesando…
            </>
          ) : (
            <>
              Registrar
              <IconArrowRight size={20} />
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── CaptureButton ──────────────────────────────────────────────────────────

interface CaptureButtonProps {
  variant: 'filled' | 'outlined'
  icon: React.ReactNode
  label: string
  hint: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}

function CaptureButton({ variant, icon, label, hint, active, disabled, onClick }: CaptureButtonProps) {
  const filled = variant === 'filled'

  // Salvia (#8AAB94) ya existe como `--brand-muted`. Activo oscurece a `--brand-mid`.
  const bg =
    filled
      ? (active ? 'var(--brand-mid)' : 'var(--brand-muted)')
      : (active ? 'var(--brand-muted)' : 'white')
  const fg =
    filled
      ? 'white'
      : (active ? 'white' : 'var(--brand-muted)')
  const hintColor =
    filled
      ? 'rgba(255,255,255,0.72)'
      : (active ? 'rgba(255,255,255,0.72)' : 'rgba(138,171,148,0.85)')
  const border = filled ? 'none' : '2px solid var(--brand-muted)'
  const shadow = filled ? '0 4px 12px rgba(107,140,120,0.28)' : 'none'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center transition-all disabled:opacity-50"
      style={{
        height: 90,
        borderRadius: 16,
        background: bg,
        color: fg,
        border,
        boxShadow: shadow,
        gap: 4,
        padding: '8px 4px',
      }}
    >
      {icon}
      <span className="text-[12px] font-bold leading-tight">{label}</span>
      {hint && (
        <span
          className="text-[9px] font-medium leading-tight text-center"
          style={{ color: hintColor }}
        >
          {hint}
        </span>
      )}
    </button>
  )
}

function formatRecordingTimer(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── useRecorder ────────────────────────────────────────────────────────────
// Hook interno para encapsular MediaRecorder + Whisper + cleanup. Misma lógica
// crítica que tenía la versión vieja `voice-button.tsx`: liberación inmediata
// del stream con `track.stop()` para que iOS Safari no deje el ícono del mic
// activo. Hooks de pagehide/visibilitychange/freeze/blur garantizan cleanup.

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

function useRecorder() {
  const [supported, setSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const recorderRef  = useRef<MediaRecorder | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const mimeRef      = useRef<string>('')
  const maxTimerRef  = useRef<number | null>(null)
  const tickTimerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const resultCbRef  = useRef<((text: string) => void) | null>(null)
  const phaseCbRef   = useRef<((p: Phase) => void) | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    setSupported(ok)
  }, [])

  function emitPhase(p: Phase) { phaseCbRef.current?.(p) }

  function clearTimers() {
    if (maxTimerRef.current)  { window.clearTimeout(maxTimerRef.current);  maxTimerRef.current = null }
    if (tickTimerRef.current) { window.clearInterval(tickTimerRef.current); tickTimerRef.current = null }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach(t => { try { t.stop() } catch { /* ignore */ } })
    streamRef.current = null
  }

  function hardStop() {
    clearTimers()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* ignore */ }
    }
    recorderRef.current = null
    releaseStream()
    setIsRecording(false)
    setElapsedMs(0)
  }

  // Cleanup en unmount + listeners de "el user se fue".
  useEffect(() => {
    const onPageHide   = () => hardStop()
    const onVisibility = () => { if (document.visibilityState === 'hidden') hardStop() }
    const onFreeze     = () => hardStop()
    const onBlur       = () => hardStop()

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
  }, [])

  async function start(): Promise<{ error?: string }> {
    if (!supported) return { error: 'Tu navegador no soporta dictado.' }
    setErrorMsg('')
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
        // Liberar el mic INMEDIATAMENTE.
        releaseStream()
        clearTimers()
        setIsRecording(false)

        if (chunksRef.current.length === 0) return
        const type = mimeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []

        if (blob.size < 1024) {
          setErrorMsg('Muy corto, intenta de nuevo')
          emitPhase('error')
          return
        }

        emitPhase('transcribing')
        try {
          const ext = extensionFor(type)
          const file = new File([blob], `voice.${ext}`, { type })
          const form = new FormData()
          form.append('audio', file)

          const res = await fetchWithAuthRetry('/api/transcribe', { method: 'POST', body: form })
          const data = await res.json().catch(() => null) as { text?: string; error?: string } | null

          if (!res.ok) {
            setErrorMsg(data?.error || 'No pudimos transcribir')
            emitPhase('error')
            return
          }
          const text = (data?.text ?? '').trim()
          emitPhase('idle')
          resultCbRef.current?.(text)
        } catch {
          setErrorMsg('Sin conexión. Intenta de nuevo.')
          emitPhase('error')
        }
      }

      rec.onerror = () => {
        setErrorMsg('Error al grabar.')
        hardStop()
        emitPhase('error')
      }

      rec.start()
      setIsRecording(true)
      startTimeRef.current = Date.now()
      setElapsedMs(0)
      emitPhase('recording')

      // Tick visual del timer.
      tickTimerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current)
      }, 200)

      // Cap duro: 60s.
      maxTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          try { recorderRef.current.stop() } catch { /* ignore */ }
        }
      }, MAX_RECORDING_MS)

      return {}
    } catch (err) {
      releaseStream()
      const name = (err as { name?: string } | null)?.name
      let msg = 'No se pudo activar el micrófono.'
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg = 'Permiso denegado. Habilita el micrófono en tu navegador.'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No se encontró micrófono en este dispositivo.'
      } else if (name === 'NotReadableError') {
        msg = 'Micrófono en uso por otra app.'
      }
      setErrorMsg(msg)
      return { error: msg }
    }
  }

  function stop() {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* ignore */ }
    } else {
      hardStop()
    }
  }

  function onResult(cb: (text: string) => void) {
    resultCbRef.current = cb
    return () => { resultCbRef.current = null }
  }
  function onPhase(cb: (p: Phase) => void) {
    phaseCbRef.current = cb
    return () => { phaseCbRef.current = null }
  }

  return { supported, isRecording, elapsedMs, errorMsg, start, stop, onResult, onPhase }
}

function pickMimeType(): string {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}
function extensionFor(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}
