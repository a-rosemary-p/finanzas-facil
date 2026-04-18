'use client'

import { useState } from 'react'
import { getTodayString } from '@/lib/utils'
import { VoiceButton } from './voice-button'
import { PhotoButton } from './photo-button'
import type { PendingMovement } from '@/types'

interface EntryFormProps {
  onMovementsExtracted: (data: {
    rawText: string
    entryDate: string
    movements: PendingMovement[]
  }) => void
}

export function EntryForm({ onMovementsExtracted }: EntryFormProps) {
  const [texto, setTexto] = useState('')
  const [fecha, setFecha] = useState(getTodayString())
  const [loading, setLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), fechaMovimiento: fecha }),
      })
      const data: unknown = await res.json()

      if (!res.ok) {
        const err = data as Record<string, unknown>
        if (err['error'] === 'LIMIT_EXCEEDED') {
          setError(err['message'] as string)
        } else {
          setError((err['error'] as string) || 'Error al procesar. Intenta de nuevo.')
        }
        return
      }

      const { movements } = data as { movements: PendingMovement[] }
      onMovementsExtracted({ rawText: texto.trim(), entryDate: fecha, movements })
      setTexto('')
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const busy = loading || photoLoading

  return (
    <div
      className="bg-white rounded-xl shadow-sm p-4"
      style={{ border: '1px solid #E0E0E0' }}
    >
      <p className="font-bold mb-3" style={{ color: '#1A2B3A' }}>
        ¿Qué pasó hoy en tu negocio?
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Ej: vendí 1,500 en tacos, gasté 300 en tortillas y 120 en gas. Mañana debo pagar 400 de renta."
          rows={3}
          disabled={busy}
          className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2"
          style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
        />

        {/* Fila: fecha + botones de entrada por voz/foto */}
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium" style={{ color: '#5A7A8A' }}>
              ¿Cuándo ocurrió?
            </label>
            <input
              type="date"
              value={fecha}
              max={getTodayString()}
              onChange={e => setFecha(e.target.value)}
              disabled={busy}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 w-full"
              style={{ borderColor: '#E0E0E0', color: '#1A2B3A' }}
            />
          </div>

          {/* Voz */}
          <VoiceButton
            onTranscript={t => setTexto(prev => prev ? `${prev} ${t}` : t)}
            disabled={busy}
          />

          {/* Foto */}
          <PhotoButton
            fecha={fecha}
            onMovementsExtracted={onMovementsExtracted}
            onError={setError}
            disabled={loading}
            loading={photoLoading}
            onLoadingChange={setPhotoLoading}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: '#C62828' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !texto.trim()}
          className="text-white rounded-xl py-3.5 font-bold text-base transition-opacity disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
          style={{ background: '#2E7D32' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Procesando con IA...
            </>
          ) : (
            'Registrar'
          )}
        </button>
      </form>
    </div>
  )
}
