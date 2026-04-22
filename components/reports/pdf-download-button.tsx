'use client'
// This component is loaded with dynamic({ ssr: false }) — do not import it directly in server code.
import { PDFDownloadLink } from '@react-pdf/renderer'
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
  return (
    <PDFDownloadLink
      document={
        <MonthlyReportDoc
          month={month}
          movements={movements}
          displayName={displayName}
          giro={giro}
        />
      }
      fileName={`fiza-reporte-${month}.pdf`}
    >
      {({ loading: pdfLoading }) => (
        <button
          type="button"
          disabled={pdfLoading}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 min-h-[48px]"
          style={{ background: 'var(--brand)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {pdfLoading ? 'Generando PDF...' : `Descargar PDF · ${monthLabel(month)}`}
        </button>
      )}
    </PDFDownloadLink>
  )
}
