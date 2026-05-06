'use client'
// v0.291 rework: single sheet con banner Fiza brand horizontal arriba y texto
// "Tipo" coloreado por categoría (verde/rojo/amarillo).
//
// Cambio de lib: `xlsx` (sheetjs community) → `exceljs`. La community edition
// de sheetjs NO soporta escribir estilos; el fork con estilos (`xlsx-js-style`)
// es maintenance risk. exceljs está activamente mantenido, tiene API limpia
// para fills/fonts/merges, y pesa similar (~700KB). Lo cargamos via
// `await import('exceljs')` dentro del handler para mantener el bundle limpio.
//
// El componente sigue cargándose con `dynamic({ ssr: false })` desde la página.

import { useRef, useState } from 'react'
import { shareOrDownload } from '@/lib/file-share'
import { track } from '@/lib/analytics'
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

// Brand colors — espejo de globals.css. Los hex SIN # porque exceljs los pide
// en formato ARGB (ocho hex digits, los primeros dos son alfa = FF opaco).
const BRAND          = 'FF578466' // --brand
const BRAND_DEEP     = 'FF3F6450' // tono más oscuro para el banner top
const BRAND_CHIP     = 'FFF4F6EB' // bg suave para sección headers
const PAPER          = 'FFFCFDF8' // base white
const INK_TEXT       = 'FF1B2A23' // texto principal oscuro
const INCOME_TEXT    = 'FF578466' // verde
const EXPENSE_TEXT   = 'FFD0481A' // naranja-rojo
const PENDING_TEXT   = 'FFB89010' // amarillo
const NETO_STRONG    = 'FF2E5266' // slate-petróleo (v0.29)

// Mapeo del color del texto de la celda "Tipo" — la única celda con color
// según spec v0.291.
function tipoColor(m: Movement): string {
  if (m.type === 'pendiente') return PENDING_TEXT
  if (m.type === 'ingreso')   return INCOME_TEXT
  return EXPENSE_TEXT // gasto (incluye inversiones marcadas como gasto)
}

function tipoLabel(m: Movement): string {
  if (m.type === 'pendiente') return 'Pendiente'
  if (m.type === 'ingreso')   return 'Ingreso'
  return 'Gasto'
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

      // Carga exceljs solo cuando el user pide el Excel — chunk separado.
      const ExcelJS = (await import('exceljs')).default

      if (myId !== reqIdRef.current) return

      // Filtramos según el toggle de inversiones; pendientes ya vienen
      // filtrados desde el server.
      const filtered = movements.filter(m => includeInvestments || !m.isInvestment)

      // Totales (excluyendo pendientes — pendientes no son "real money" todavía)
      let totalIncome = 0
      let totalExpenses = 0
      const byCategory = new Map<string, { income: number; expenses: number; count: number }>()

      for (const m of filtered) {
        if (!byCategory.has(m.category)) {
          byCategory.set(m.category, { income: 0, expenses: 0, count: 0 })
        }
        const bucket = byCategory.get(m.category)!
        bucket.count += 1
        if (m.type === 'ingreso') {
          totalIncome += m.amount
          bucket.income += m.amount
        } else if (m.type === 'gasto') {
          totalExpenses += m.amount
          bucket.expenses += m.amount
        }
      }

      const sortedCats = Array.from(byCategory.entries())
        .sort((a, b) => (b[1].income - b[1].expenses) - (a[1].income - a[1].expenses))

      // ── Workbook + sheet único ────────────────────────────────────────
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Fiza'
      wb.created = new Date()
      const ws = wb.addWorksheet('Reporte', {
        views: [{ showGridLines: false }],
        properties: { defaultRowHeight: 18 },
      })

      // Anchos de columna — 5 columnas para los movimientos
      ws.columns = [
        { width: 12 }, // A: Fecha
        { width: 38 }, // B: Descripción
        { width: 12 }, // C: Tipo
        { width: 22 }, // D: Categoría
        { width: 14 }, // E: Monto
      ]

      // Helper: "center across selection" — el equivalente correcto a merge+
      // center sin los problemas de merge (ordenar/filtrar/copiar). El valor
      // vive solo en la primera celda; las demás llevan la misma alineación
      // (`centerContinuous`) y el mismo fill para que el bg no se corte.
      type FillSpec = { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } }
      type FontSpec = NonNullable<ReturnType<typeof ws.getCell>['font']>
      function centerAcross(row: number, value: string, font: FontSpec, fill?: FillSpec) {
        for (let c = 1; c <= 5; c++) {
          const cell = ws.getCell(row, c)
          if (c === 1) cell.value = value
          cell.font = font
          cell.alignment = { vertical: 'middle', horizontal: 'centerContinuous' }
          if (fill) cell.fill = fill
        }
      }

      // ── Banner Fiza horizontal (fila 1) ───────────────────────────────
      // Antes era A1:E2 merged. Ahora un solo row alto + centerContinuous.
      centerAcross(
        1,
        `Fiza · Reporte de ingresos y gastos · ${periodLabel}`,
        { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DEEP } },
      )
      ws.getRow(1).height = 36

      // ── Subtitle (fila 2): user · giro · generado ─────────────────────
      const generated = new Date().toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
      centerAcross(
        2,
        `${displayName}${giro ? ` · ${giro}` : ''}  ·  Generado: ${generated}`,
        { name: 'Calibri', size: 10, color: { argb: 'FF7A8B82' } },
      )
      ws.getRow(2).height = 18

      // Fila 3 vacía (espacio respiro)
      ws.getRow(3).height = 8

      // ── TOTALES ───────────────────────────────────────────────────────
      centerAcross(
        4,
        'TOTALES',
        { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND } },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_CHIP } },
      )
      ws.getRow(4).height = 22

      const totalsRows: Array<[string, number, string]> = [
        ['Ingresos', totalIncome,                INCOME_TEXT],
        ['Gastos',   totalExpenses,              EXPENSE_TEXT],
        ['Neto',     totalIncome - totalExpenses, NETO_STRONG],
      ]
      let r = 5
      for (const [label, value, color] of totalsRows) {
        const labelCell = ws.getCell(`A${r}`)
        labelCell.value = label
        labelCell.font = { name: 'Calibri', size: 11, color: { argb: INK_TEXT } }
        const valCell = ws.getCell(`E${r}`)
        valCell.value = value
        valCell.numFmt = '"$"#,##0.00'
        valCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: color } }
        valCell.alignment = { horizontal: 'right' }
        r++
      }

      // Espacio
      r++

      // ── DESGLOSE POR CATEGORÍA ────────────────────────────────────────
      if (sortedCats.length > 0) {
        centerAcross(
          r,
          'DESGLOSE POR CATEGORÍA',
          { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND } },
          { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_CHIP } },
        )
        ws.getRow(r).height = 22
        r++

        const colsRow = r
        const colHeaders = ['Categoría', 'Ingresos', 'Gastos', 'Neto', '#']
        colHeaders.forEach((label, i) => {
          const cell = ws.getCell(colsRow, i + 1)
          cell.value = label
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INK_TEXT } }
          cell.alignment = { horizontal: i === 0 ? 'left' : 'right' }
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFE3E7DC' } } }
        })
        r++

        for (const [cat, data] of sortedCats) {
          const net = data.income - data.expenses
          ws.getCell(r, 1).value = cat
          ws.getCell(r, 2).value = data.income
          ws.getCell(r, 3).value = data.expenses
          ws.getCell(r, 4).value = net
          ws.getCell(r, 5).value = data.count

          ws.getCell(r, 2).numFmt = '"$"#,##0.00'
          ws.getCell(r, 3).numFmt = '"$"#,##0.00'
          ws.getCell(r, 4).numFmt = '"$"#,##0.00'
          ws.getCell(r, 4).font = {
            name: 'Calibri', size: 10, bold: true,
            color: { argb: net >= 0 ? INCOME_TEXT : EXPENSE_TEXT },
          }
          ws.getCell(r, 1).font = { name: 'Calibri', size: 10, color: { argb: INK_TEXT } }
          for (let c = 2; c <= 5; c++) {
            ws.getCell(r, c).alignment = { horizontal: 'right' }
          }
          r++
        }

        r++ // espacio
      }

      // ── MOVIMIENTOS ───────────────────────────────────────────────────
      centerAcross(
        r,
        'MOVIMIENTOS',
        { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND } },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_CHIP } },
      )
      ws.getRow(r).height = 22
      r++

      // Headers de columnas
      const movsColRow = r
      const movsCols = ['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Monto']
      movsCols.forEach((label, i) => {
        const cell = ws.getCell(movsColRow, i + 1)
        cell.value = label
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INK_TEXT } }
        cell.alignment = { horizontal: i === 4 ? 'right' : 'left' }
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE3E7DC' } } }
      })
      r++

      // Data rows — ordenadas por fecha desc
      const sortedMovs = filtered.slice().sort((a, b) => b.movementDate.localeCompare(a.movementDate))
      for (const m of sortedMovs) {
        ws.getCell(r, 1).value = m.movementDate
        ws.getCell(r, 1).font = { name: 'Calibri', size: 10, color: { argb: INK_TEXT } }

        const descLabel = m.isInvestment ? `${m.description} (Inversión)` : m.description
        ws.getCell(r, 2).value = descLabel
        ws.getCell(r, 2).font = { name: 'Calibri', size: 10, color: { argb: INK_TEXT } }

        const tipoCell = ws.getCell(r, 3)
        tipoCell.value = tipoLabel(m)
        tipoCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: tipoColor(m) } }

        ws.getCell(r, 4).value = m.category
        ws.getCell(r, 4).font = { name: 'Calibri', size: 10, color: { argb: INK_TEXT } }

        const amount = ws.getCell(r, 5)
        amount.value = m.amount
        amount.numFmt = '"$"#,##0.00'
        amount.alignment = { horizontal: 'right' }
        amount.font = { name: 'Calibri', size: 10, color: { argb: INK_TEXT } }

        r++
      }

      // Aplicar fondo paper a toda el área usada (look más limpio que el default
      // gris de Excel)
      const lastRow = r - 1
      for (let row = 1; row <= lastRow; row++) {
        for (let col = 1; col <= 5; col++) {
          const cell = ws.getCell(row, col)
          if (!cell.fill || (cell.fill as { type?: string }).type === undefined) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAPER } }
          }
        }
      }

      if (myId !== reqIdRef.current) return

      // ── Generar Blob ─────────────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer as ArrayBuffer], { type: XLSX_MIME })

      if (myId !== reqIdRef.current) return

      await shareOrDownload({
        blob,
        fileName,
        shareTitle: `Reporte ${periodLabel} · Fiza`,
        mimeType: XLSX_MIME,
      })

      if (myId !== reqIdRef.current) return
      track('report_exported', {
        format: 'excel',
        period_slug: periodSlug,
        period_label: periodLabel,
        movements_count: movements.length,
      })
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
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px] transition-colors bg-brand-chip border border-brand text-brand"
      >
        {busy ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" className="fz-spin">
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
            Excel
          </>
        )}
      </button>
      {errorMsg && (
        <p className="text-xs text-center text-danger">{errorMsg}</p>
      )}
    </div>
  )
}
