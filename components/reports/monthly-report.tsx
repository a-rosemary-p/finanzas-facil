// NOTE: This file must only be imported with dynamic({ ssr: false }) — react-pdf does not run on the server.
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Movement } from '@/types'

const BRAND = '#578466'
const BRAND_LIGHT = '#92C3A5'
const BRAND_LIME = '#DAE68F'
const DANGER = '#D0481A'
const MUTED = '#7A9A88'
const BORDER = '#C8E0D3'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a2e24',
    padding: 36,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottom: `2pt solid ${BRAND}`,
    paddingBottom: 8,
    marginBottom: 14,
  },
  appName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  monthLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
  },
  businessName: {
    fontSize: 9,
    color: MUTED,
    marginTop: 2,
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },

  // Section title
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_LIME,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#F7FBF8',
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  colDate: { width: '13%' },
  colDesc: { width: '38%' },
  colCat: { width: '18%' },
  colType: { width: '13%' },
  colAmt: { width: '18%', textAlign: 'right' },
  cellHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
  },
  cellText: {
    fontSize: 8,
    color: '#1a2e24',
  },
  cellMuted: {
    fontSize: 8,
    color: MUTED,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `0.5pt solid ${BORDER}`,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
})

function fmt(n: number): string {
  const abs = Math.abs(n)
  const formatted = abs >= 1000
    ? '$' + Math.round(abs).toLocaleString('en-US')
    : '$' + abs.toFixed(2)
  return n < 0 ? `−${formatted}` : formatted
}

function formatDate(d: string): string {
  // d is YYYY-MM-DD
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface MonthlyReportDocProps {
  month: string        // 'YYYY-MM'
  movements: Movement[]
  displayName: string
  giro?: string
}

export function MonthlyReportDoc({ month, movements, displayName, giro }: MonthlyReportDocProps) {
  // Compute metrics (exclude investments from totals)
  let income = 0
  let expenses = 0
  for (const m of movements) {
    if (m.isInvestment) continue
    if (m.type === 'ingreso') income += m.amount
    else if (m.type === 'gasto') expenses += m.amount
  }
  const net = income - expenses

  // Month label
  const [year, mon] = month.split('-').map(Number)
  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric',
  })
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  // Sort movements by date desc
  const sorted = [...movements].sort((a, b) =>
    b.movementDate.localeCompare(a.movementDate) || a.description.localeCompare(b.description)
  )

  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>fiza</Text>
          <View style={styles.headerRight}>
            <Text style={styles.monthLabel}>{monthTitle}</Text>
            <Text style={styles.businessName}>
              {displayName}{giro ? ` · ${giro}` : ''}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: '#DAE68F', border: `1pt solid ${BRAND_LIGHT}` }]}>
            <Text style={[styles.summaryLabel, { color: BRAND }]}>INGRESOS</Text>
            <Text style={[styles.summaryAmount, { color: BRAND }]}>{fmt(income)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FAD5BF', border: '1pt solid #F79366' }]}>
            <Text style={[styles.summaryLabel, { color: DANGER }]}>GASTOS</Text>
            <Text style={[styles.summaryAmount, { color: DANGER }]}>{fmt(expenses)}</Text>
          </View>
          <View style={[styles.summaryCard, {
            backgroundColor: net >= 0 ? '#DAE68F' : '#FAD5BF',
            border: `1pt solid ${net >= 0 ? BRAND_LIGHT : '#F79366'}`,
          }]}>
            <Text style={[styles.summaryLabel, { color: net >= 0 ? BRAND : DANGER }]}>NETO</Text>
            <Text style={[styles.summaryAmount, { color: net >= 0 ? BRAND : DANGER }]}>
              {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
            </Text>
          </View>
        </View>

        {/* Movement table */}
        <Text style={styles.sectionTitle}>Movimientos ({sorted.length})</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, styles.colDate]}>Fecha</Text>
          <Text style={[styles.cellHeader, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.cellHeader, styles.colCat]}>Categoría</Text>
          <Text style={[styles.cellHeader, styles.colType]}>Tipo</Text>
          <Text style={[styles.cellHeader, styles.colAmt]}>Monto</Text>
        </View>

        {sorted.map((m, i) => {
          const isIncome = m.type === 'ingreso'
          const isPending = m.type === 'pendiente'
          const amountColor = isIncome ? BRAND : isPending ? MUTED : DANGER
          const Row = i % 2 === 0 ? styles.tableRow : styles.tableRowAlt
          return (
            <View key={m.id} style={Row}>
              <Text style={[styles.cellMuted, styles.colDate]}>{formatDate(m.movementDate)}</Text>
              <Text style={[styles.cellText, styles.colDesc]}>{m.description}</Text>
              <Text style={[styles.cellMuted, styles.colCat]}>{m.category}</Text>
              <Text style={[styles.cellMuted, styles.colType]}>{capitalize(m.type)}</Text>
              <Text style={[styles.cellText, styles.colAmt, { color: amountColor, fontFamily: 'Helvetica-Bold' }]}>
                {isIncome ? '+' : isPending ? '' : '−'}{fmt(m.amount)}
              </Text>
            </View>
          )
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generado con Fiza · fiza.app</Text>
          <Text style={styles.footerText}>{today}</Text>
        </View>
      </Page>
    </Document>
  )
}
