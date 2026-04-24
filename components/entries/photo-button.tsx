'use client'

import { useRef } from 'react'
import { PHOTO_LIMITS } from '@/lib/constants'
import { processImage } from '@/lib/image-utils'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { PendingMovement } from '@/types'
import { getTodayString } from '@/lib/utils'

interface PhotoButtonProps {
  fecha: string
  onMovementsExtracted: (data: {
    rawText: string
    entryDate: string
    movements: PendingMovement[]
  }) => void
  onError: (msg: string) => void
  disabled?: boolean
  loading?: boolean
  onLoadingChange: (v: boolean) => void
}

export function PhotoButton({
  fecha,
  onMovementsExtracted,
  onError,
  disabled,
  loading,
  onLoadingChange,
}: PhotoButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target) return
    e.target.value = '' // permite seleccionar el mismo archivo de nuevo
    if (!file) return

    if (!PHOTO_LIMITS.acceptedFormats.includes(file.type as typeof PHOTO_LIMITS.acceptedFormats[number])) {
      onError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }

    if (file.size > PHOTO_LIMITS.maxFileSizeMB * 1024 * 1024 * 3) {
      onError('La imagen es demasiado grande.')
      return
    }

    onLoadingChange(true)
    onError('')

    try {
      const { base64, mimeType } = await processImage(file)

      const res = await fetchWithAuthRetry('/api/entry/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType, fechaMovimiento: fecha || getTodayString() }),
      })

      const data: unknown = await res.json()

      if (!res.ok) {
        const err = data as Record<string, unknown>
        if (err['error'] === 'LIMIT_EXCEEDED') {
          onError(err['message'] as string)
        } else {
          onError((err['error'] as string) || 'Error al analizar la imagen.')
        }
        return
      }

      const { movements } = data as { movements: PendingMovement[] }
      onMovementsExtracted({
        rawText: '📷 Foto analizada con IA',
        entryDate: fecha || getTodayString(),
        movements,
      })
    } catch {
      onError('No pudimos conectar con el servidor. Intenta de nuevo.')
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading}
        title="Tomar foto o subir imagen"
        className="flex items-center justify-center rounded-xl transition-all min-h-[44px] min-w-[44px]"
        style={{
          background: 'var(--brand-chip)',
          border: `1px solid ${loading ? 'var(--brand-border)' : 'var(--brand)'}`,
          color: loading ? 'var(--brand-mid)' : 'var(--brand)',
        }}
      >
        {loading ? (
          <span className="flex items-center gap-1.5 px-3 text-sm font-medium">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analizando...
          </span>
        ) : (
          <span className="text-xl">📷</span>
        )}
      </button>
    </>
  )
}
