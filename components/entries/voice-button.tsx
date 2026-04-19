'use client'

import { useState, useRef, useEffect } from 'react'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

// Tipos para Web Speech API (no incluidos en lib dom por defecto)
interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
}

interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

// Compatibilidad real de Web Speech API:
// ✅ Chrome (desktop + Android)   ✅ Safari (iOS 14.5+, macOS 14.1+)
// ✅ Edge / Samsung Internet       ❌ Firefox (desktop + Android) — no soportado
// ❌ Algunos WebViews de Android   ⚠️  Requiere HTTPS y permiso de micrófono

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  // null = aún no hidratado (SSR), evita flash de contenido incorrecto
  const [supported, setSupported] = useState<boolean | null>(null)
  const [recording, setRecording] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  // Durante SSR no renderiza nada (evita mismatch de hidratación)
  if (supported === null) return null

  // Browser sin soporte → botón deshabilitado con tooltip explicativo
  // (mejor que desaparecer sin avisar)
  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Dictado no disponible en este navegador. Usa Chrome o Safari."
        className="flex items-center justify-center rounded-xl min-h-[44px] min-w-[44px] opacity-40 cursor-not-allowed"
        style={{ background: '#F5F5F5', border: '1px solid #E0E0E0', color: '#5A7A8A' }}
      >
        <span className="text-xl">🎤</span>
      </button>
    )
  }

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 4000)
  }

  function start() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    setErrorMsg('')

    const rec = new SR()
    rec.lang = 'es-MX'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => setRecording(true)
    rec.onend = () => setRecording(false)

    rec.onerror = (e) => {
      setRecording(false)
      const code = e?.error
      // Códigos de error del Web Speech API
      if (code === 'not-allowed' || code === 'permission-denied') {
        showError('Permiso denegado — habilita el micrófono en tu navegador')
      } else if (code === 'network') {
        showError('Sin conexión para voz')
      } else if (code === 'no-speech') {
        showError('No se detectó audio. Habla más cerca del micrófono.')
      } else if (code === 'audio-capture') {
        showError('No se encontró micrófono en este dispositivo')
      } else if (code === 'service-not-allowed') {
        showError('Dictado no disponible. Usa Chrome o Safari.')
      } else if (code === 'aborted') {
        // El usuario detuvo manualmente — no mostrar error
      } else {
        showError('Micrófono no disponible. Intenta de nuevo.')
      }
    }

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) onTranscript(transcript)
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch {
      setRecording(false)
      showError('No se pudo activar el micrófono. Recarga la página.')
    }
  }

  function stop() {
    recognitionRef.current?.stop()
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled}
        title={recording ? 'Detener grabación' : 'Dictar por voz'}
        className="flex items-center justify-center rounded-xl transition-all min-h-[44px] min-w-[44px]"
        style={{
          background: recording ? '#FFF5F5' : '#F0FAF4',
          border: `1px solid ${recording ? '#C62828' : '#2E7D32'}`,
          color: recording ? '#C62828' : '#2E7D32',
        }}
      >
        {recording ? (
          <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            Grabando...
          </span>
        ) : (
          <span className="text-xl">🎤</span>
        )}
      </button>
      {errorMsg && (
        <p className="text-xs max-w-[160px]" style={{ color: '#C62828' }}>{errorMsg}</p>
      )}
    </div>
  )
}
