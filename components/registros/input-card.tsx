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
import { processImage, readAsBase64 } from '@/lib/image-utils'
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
  inputSource: 'text' | 'voice' | 'photo'
}

interface Props {
  onMovementsExtracted: (data: PendingData) => void
  /** Onboarding: cuál botón resaltar con halo (foto/dictar/escribir) o null. */
  onboardingHighlight?: 'foto' | 'dictar' | 'escribir' | null
}

type Mode = 'foto' | 'dictar' | 'escribir' | null

export function InputCard({ onMovementsExtracted, onboardingHighlight = null }: Props) {
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
      setError('Formato no soportado. Usa JPG, PNG, WebP o PDF.')
      return
    }
    const isPdf = file.type === 'application/pdf'
    const sizeLimitMB = isPdf ? PHOTO_LIMITS.pdfMaxFileSizeMB : PHOTO_LIMITS.maxFileSizeMB
    if (file.size > sizeLimitMB * 1024 * 1024 * 3) {
      setError(isPdf
        ? `El PDF es demasiado grande (máx. ${sizeLimitMB} MB).`
        : `La imagen es demasiado grande (máx. ${sizeLimitMB} MB).`)
      return
    }

    setPhotoLoading(true)
    try {
      // PDFs van tal cual (no podemos rasterizar via canvas y el PDF es lo que
      // vamos a mandar a OpenAI). Imágenes se redimensionan + comprimen en
      // cliente para reducir el payload y mejorar el OCR.
      const { base64, mimeType } = isPdf
        ? await readAsBase64(file)
        : await processImage(file)

      const res = await fetchWithAuthRetry('/api/entry/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType, fechaMovimiento: getTodayString() }),
      })
      const data = await res.json() as { movements?: PendingMovement[]; error?: string; message?: string }
      if (!res.ok) {
        setError(data.message || data.error || (isPdf ? 'Error al analizar el PDF.' : 'Error al analizar la imagen.'))
        return
      }
      onMovementsExtracted({
        rawText: isPdf ? 'PDF analizado con IA' : 'Imagen analizada con IA',
        entryDate: getTodayString(),
        movements: data.movements ?? [],
        inputSource: 'photo',
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
      await submitText(transcript, getTodayString(), 'voice')
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

  // ── ESCRIBIR / DICTAR (mismo pipeline) ───────────────────────────────────
  async function submitText(
    rawText: string,
    entryDate: string,
    inputSource: 'text' | 'voice' = 'text',
  ) {
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
        inputSource,
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
    <div className="rounded-2xl bg-white p-3.5 border border-brand-border shadow-fz-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <IconChatText size={18} className="text-brand-muted" />
        <span className="text-sm font-bold text-ink-900">
          ¿Qué pasó hoy en tu negocio?
        </span>
      </div>

      {/* NOTA sobre el input file: NO ponemos `capture="environment"`. Ese
       * atributo fuerza la cámara directa y se pierde el sheet nativo de
       * iOS/Android que ofrece Cámara / Foto Library / Archivos. Sin el
       * atributo, ambos sistemas operativos muestran el menú correcto
       * automáticamente. En desktop el comportamiento es el mismo (file picker). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <div className={`grid grid-cols-3 gap-2 ${escribirOpen ? 'mb-3' : ''}`}>
        <CaptureButton
          variant="filled"
          icon={photoLoading ? <Spinner size={28} /> : <IconCamera size={28} />}
          label={photoLoading ? 'Analizando…' : 'Foto / PDF'}
          hint={photoLoading ? '' : 'Recibos, facturas, estados'}
          active={photoLoading}
          disabled={busy && !photoLoading}
          highlighted={onboardingHighlight === 'foto'}
          dimmed={onboardingHighlight !== null && onboardingHighlight !== 'foto'}
          onClick={openPhotoPicker}
        />
        <CaptureButton
          variant="filled"
          icon={
            transcribing
              ? <Spinner size={28} />
              : <IconMicrophone size={28} />
          }
          label={
            recorder.isRecording
              ? formatRecordingTimer(recorder.elapsedMs)
              : transcribing
              ? 'Transcribiendo…'
              : 'Dictar'
          }
          hint={recorder.isRecording || transcribing ? '' : 'Cuéntame qué pasó'}
          active={recorder.isRecording || transcribing}
          disabled={(busy && !recorder.isRecording && !transcribing) || !recorder.supported}
          highlighted={onboardingHighlight === 'dictar'}
          dimmed={onboardingHighlight !== null && onboardingHighlight !== 'dictar'}
          onClick={toggleRecording}
        />
        <CaptureButton
          variant="outlined"
          icon={<IconPencil size={28} />}
          label="Escribir"
          hint="Texto libre"
          active={escribirOpen}
          disabled={busy}
          highlighted={onboardingHighlight === 'escribir'}
          dimmed={onboardingHighlight !== null && onboardingHighlight !== 'escribir'}
          onClick={() => setMode(m => m === 'escribir' ? null : 'escribir')}
        />
      </div>

      {/* Textarea expandible — el max-height animado es la diferencia entre
       * "no abierto" y "abierto"; lo dejamos inline porque depende del state. */}
      <div
        className="overflow-hidden transition-[max-height] duration-std ease-standard"
        style={{ maxHeight: escribirOpen ? 220 : 0 }}
      >
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Ej: cobré $8,500 del proyecto del cliente, $1,200 fue de comisiones."
          disabled={busy}
          className="w-full text-sm fz-write-input mt-1"
        />
      </div>

      {/* Fecha expandible (Escribir) */}
      <div
        className="overflow-hidden transition-[max-height] duration-std ease-standard"
        style={{ maxHeight: escribirOpen ? 80 : 0 }}
      >
        <div className="mt-2.5">
          <div className="text-xs font-semibold mb-1.5 text-ink-500">
            ¿Cuándo ocurrió?
          </div>
          <label className="flex items-center justify-between rounded-xl bg-paper-2 border border-brand-border px-3 py-2 cursor-pointer">
            <input
              type="date"
              value={fecha}
              max={getTodayString()}
              onChange={e => setFecha(e.target.value)}
              disabled={busy}
              className="text-sm font-medium bg-transparent focus:outline-none flex-1 min-w-0 text-ink-700"
            />
            <IconCalendar size={20} className="text-brand-muted" />
          </label>
        </div>
      </div>

      {/* Error inline */}
      {error && (
        <p className="text-xs mt-2.5 text-danger">
          {error}
        </p>
      )}

      {/* Botón Registrar — solo cuando Escribir está abierto */}
      {escribirOpen && (
        <button
          type="button"
          onClick={handleEscribirSubmit}
          disabled={busy || !text.trim()}
          className="fz-btn-submit-write"
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
  /** Onboarding: aplica halo pulsante via la clase global `fz-onboarding-halo`. */
  highlighted?: boolean
  /** Onboarding: este botón NO es el target — se ve atenuado bajo el backdrop. */
  dimmed?: boolean
  onClick: () => void
}

function CaptureButton({
  variant, icon, label, hint, active, disabled,
  highlighted = false, dimmed = false, onClick,
}: CaptureButtonProps) {
  const className = [
    'fz-capture-btn',
    `fz-capture-btn--${variant}`,
    active ? 'is-active' : '',
    dimmed ? 'fz-capture-btn--dimmed' : '',
    highlighted ? 'fz-onboarding-halo' : '',
  ].filter(Boolean).join(' ')

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {icon}
      <span className="text-xs font-bold leading-tight">{label}</span>
      {hint && (
        <span className="fz-capture-btn__hint">{hint}</span>
      )}
    </button>
  )
}

// Spinner inline para los CaptureButtons cuando están "procesando" (Foto
// analizando con OCR+LLM, Dictar transcribiendo con Whisper). Reemplaza el
// ícono del botón sin cambiar layout.
//
// Usa `currentColor` igual que los íconos — hereda el color del padre, así
// queda blanco sobre fondo salvia automáticamente.
function Spinner({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="fz-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
