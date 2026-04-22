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

  async function handleClick() {
    setLoading(true)
    try {
      const logoUrl = window.location.origin + '/logo-green.png'
      const fileName = `fiza-reporte-${month}.pdf`

      const blob = await pdf(
        <MonthlyReportDoc
          month={month}
          movements={movements}
          displayName={displayName}
          giro={giro}
          logoUrl={logoUrl}
        />
      ).toBlob()

      const file = new File([blob], fileName, { type: 'application/pdf' })

      // Mobile / tablet: use Web Share API to open the native share sheet
      // This lets the user attach the file to an email, save to Files, etc.
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

      // Desktop: trigger a normal file download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      // AbortError = user dismissed the share sheet — not an error worth surfacing
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[PDF generation]', err)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 min-h-[48px]"
      style={{ background: 'var(--brand)' }}
    >
      {loading ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Generando PDF...
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {`Descargar PDF · ${monthLabel(month)}`}
        </>
      )}
    </button>
  )
}
