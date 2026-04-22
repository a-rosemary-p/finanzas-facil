'use client'
// Loaded with dynamic({ ssr: false }) — do not import directly in server code.
import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { MonthlyReportDoc } from './monthly-report'
import type { Movement } from '@/types'

interface Props {
  month: string
  movements: Movement[]
  displayName: string
  giro?: string
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const raw = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function PdfDownloadButton({ month, movements, displayName, giro }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const logoUrl = window.location.origin + '/logo-green.png'
      const fileName = `fiza-reporte-${month}.pdf`

      // Render PDF with a 20-second timeout (font/image fetches can be slow)
      const blobPromise = pdf(
        <MonthlyReportDoc
          month={month}
          movements={movements}
          displayName={displayName}
          giro={giro}
          logoUrl={logoUrl}
        />
      ).toBlob()

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 20_000)
      )

      const blob = await Promise.race([blobPromise, timeout])

      const file = new File([blob], fileName, { type: 'application/pdf' })

      // Mobile / tablet: native share sheet (attach to email, save to Files, etc.)
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Reporte ${monthLabel(month)} · Fiza`,
        })
        return
      }

      // Desktop: trigger normal file download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return // user dismissed share sheet
      const msg = err instanceof Error && err.message === 'timeout'
        ? 'Tardó demasiado. Intenta de nuevo.'
        : 'No se pudo generar el PDF. Intenta de nuevo.'
      setError(msg)
      console.error('[PDF]', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 min-h-[48px]"
        style={{ background: 'var(--brand)' }}
      >
        {loading ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generando PDF...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {`Descargar PDF · ${monthLabel(month)}`}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-center" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
