'use client'
// Loaded with dynamic({ ssr: false }) — la lib xlsx pesa ~700KB, solo
// queremos cargarla cuando el user efectivamente click el botón.
//
// El import de 'xlsx' es ASÍNCRONO dentro del handler (await import('xlsx'))
// para que Next no la incluya en el chunk de la página. Resultado: el bundle
// de /reportes no crece por esta lib hasta que el user pide su Excel.

import { useRef, useState } from 'react'
import { shareOrDownload } from '@/lib/file-share'
import type { Movement } from '@/types'

interface Props {
  periodSlug: string
  periodLabel: string
  movements: Movement[]
  displayName: string
  giro?: string
  /** Refleja el toggle de "Incluir inversiones" de la pantalla */
  includeInvestments?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; msg: string }

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Excel limita los nombres de sheet a 31 caracteres y prohíbe ciertos chars
function sanitizeSheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, '').slice(0, 31)
}

export default function ExcelDownloadButton({
  periodSlug, periodLabel, movements, displayName, giro, includeInvestments,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const reqIdRef = useRef(0)

  async function handleClick() {
    const myId = ++reqIdRef.current
    setState({ kind: 'busy' })

    try {
      const fileName = `fiza-reporte-${periodSlug}.xlsx`

      // Carga xlsx solo cuando el user pide el Excel — chunk separado del bundle.
      const XLSX = await import('xlsx')

      if (myId !== reqIdRef.current) return

      // ── Construir el workbook ─────────────────────────────────────────
      // Filtramos según el toggle de inversiones; pendientes ya vienen
      // filtrados desde el server.
      const filtered = movements.filter(m => includeInvestments || !m.isInvestment)

      // Agrupar por categoría
      const byCategory: Record<string, { income: number; expenses: number; movs: Movement[] }> = {}
      let totalIncome = 0
      let totalExpenses = 0

      for (const m of filtered) {
        if (!byCategory[m.category]) byCategory[m.category] = { income: 0, expenses: 0, movs: [] }
        byCategory[m.category].movs.push(m)
        if (m.type === 'ingreso') {
          totalIncome += m.amount
          byCategory[m.category].income += m.amount
        } else if (m.type === 'gasto') {
          totalExpenses += m.amount
          byCategory[m.category].expenses += m.amount
        }
      }

      const wb = XLSX.utils.book_new()

      // ── Sheet 1: Resumen ─────────────────────────────────────────────
      const summaryHeader: (string | number)[][] = [
        [`Reporte · ${periodLabel}`],
        [displayName + (giro ? ` · ${giro}` : '')],
        [`Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`],
        [],
        ['TOTALES'],
        ['Ingresos', totalIncome],
        ['Gastos', totalExpenses],
        ['Neto', totalIncome - totalExpenses],
        [],
        ['DESGLOSE POR CATEGORÍA'],
        ['Categoría', 'Ingresos', 'Gastos', 'Neto', '# Movimientos'],
      ]
      // Categorías ordenadas por monto neto descendente
      const sortedCats = Object.entries(byCategory)
        .sort((a, b) => (b[1].income - b[1].expenses) - (a[1].income - a[1].expenses))
      for (const [cat, data] of sortedCats) {
        summaryHeader.push([cat, data.income, data.expenses, data.income - data.expenses, data.movs.length])
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryHeader)
      // Anchos de columna sugeridos (en chars)
      summarySheet['!cols'] = [
        { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      ]
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen')

      // ── Sheets 2+: una hoja por categoría con movimientos ────────────
      // Se agregan en el mismo orden que el resumen para coherencia.
      for (const [cat, data] of sortedCats) {
        if (data.movs.length === 0) continue
        const rows: (string | number)[][] = [
          ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Inversión'],
          ...data.movs
            .slice()
            .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
            .map(m => [
              m.movementDate,
              m.description,
              m.type === 'ingreso' ? 'Ingreso' : 'Gasto',
              m.amount,
              m.isInvestment ? 'Sí' : '',
            ]),
          [],
          [
            'Total',
            '',
            '',
            data.movs.reduce((sum, m) => sum + (m.type === 'ingreso' ? m.amount : -m.amount), 0),
            '',
          ],
        ]
        const sheet = XLSX.utils.aoa_to_sheet(rows)
        sheet['!cols'] = [
          { wch: 12 }, { wch: 36 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
        ]
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(cat))
      }

      // Caso edge: sin movimientos en este período → solo el Resumen.
      if (sortedCats.length === 0) {
        // Ya tenemos Resumen; está bien. El user tendrá un xlsx con un solo sheet.
      }

      if (myId !== reqIdRef.current) return

      // ── Generar Blob ─────────────────────────────────────────────────
      const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([arr], { type: XLSX_MIME })

      if (myId !== reqIdRef.current) return

      // ── Share o download ─────────────────────────────────────────────
      await shareOrDownload({
        blob,
        fileName,
        shareTitle: `Reporte ${periodLabel} · Fiza`,
        mimeType: XLSX_MIME,
      })

      if (myId !== reqIdRef.current) return
      setState({ kind: 'idle' })
    } catch (err) {
      if (myId !== reqIdRef.current) return
      console.error('[Excel]', err)
      setState({ kind: 'error', msg: 'No se pudo generar el Excel. Intenta de nuevo.' })
    }
  }

  const busy = state.kind === 'busy'
  const errorMsg = state.kind === 'error' ? state.msg : ''

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px] transition-colors"
        style={{
          background: busy ? 'var(--brand-chip)' : 'var(--brand-chip)',
          border: '1px solid var(--brand)',
          color: 'var(--brand)',
        }}
      >
        {busy ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generando Excel...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Descargar Excel
          </>
        )}
      </button>
      {errorMsg && (
        <p className="text-xs text-center" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
