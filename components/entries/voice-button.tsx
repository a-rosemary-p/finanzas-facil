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
  onerror: (() => void) | null
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

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  if (!supported) return null

  function start() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'es-MX'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => setRecording(true)
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onTranscript(transcript)
    }

    recognitionRef.current = rec
    rec.start()
  }

  function stop() {
    recognitionRef.current?.stop()
  }

  return (
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
        // Ícono de stop con animación de pulso
        <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          Grabando...
        </span>
      ) : (
        <span className="text-xl">🎤</span>
      )}
    </button>
  )
}
