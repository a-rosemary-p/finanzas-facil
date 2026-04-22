// NOTE: This file must only be imported via dynamic({ ssr: false }) — react-pdf does not run on the server.
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Movement } from '@/types'

const BRAND = '#578466'
const BRAND_LIGHT = '#92C3A5'
const BRAND_LIME = '#DAE68F'
const BRAND_CHIP = '#F4F6EB'
const BRAND_BORDER = '#D9E8D0'
const DANGER = '#D0481A'
const DANGER_BG = '#FAD5BF'
const DANGER_BORDER = '#F79366'
const MUTED = '#7A9A88'
const TEXT = '#1a2e24'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
    padding: '32pt 40pt',
    backgroundColor: '#FFFFFF',
  },

  /* ── Header ── */
  header: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottom: `1.5pt solid ${BRAND}`,
    marginBottom: 20,
    gap: 6,
  },
  headerMonth: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerBusiness: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 9,
    color: MUTED,
  },

  /* ── Section title ── */
  sectionTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  /* ── Summary pills ── */
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  pillLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillAmount: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },

  /* ── Breakdown tables ── */
  breakdownBlock: {
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    marginBottom: 1,
  },
  breakdownHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  breakdownAlt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: BRAND_CHIP,
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  breakdownLabel: {
    fontSize: 8,
    color: TEXT,
  },
  breakdownAmt: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTop: `1pt solid ${BRAND_BORDER}`,
    marginTop: 1,
  },
  breakdownTotalLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: TEXT,
  },
  breakdownTotalAmt: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  /* ── Net result ── */
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  netLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  netAmount: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },

  /* ── Movement table ── */
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
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: BRAND_CHIP,
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  colDate: { width: '11%' },
  colDesc: { width: '40%' },
  colCat:  { width: '18%' },
  colType: { width: '13%' },
  colAmt:  { width: '18%', textAlign: 'right' },
  cellHeader: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND },
  cellText:   { fontSize: 8, color: TEXT },
  cellMuted:  { fontSize: 8, color: MUTED },

  /* ── Footer ── */
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `0.5pt solid ${BRAND_BORDER}`,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: MUTED },
})

/* ── Helpers ── */
function fmt(n: number): string {
  const abs = Math.abs(n)
  const str = abs >= 1000
    ? '$' + Math.round(abs).toLocaleString('en-US')
    : '$' + abs.toFixed(2)
  return n < 0 ? `−${str}` : str
}

function fmtDate(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type CategoryMap = Record<string, number>

interface MonthlyReportDocProps {
  month: string        // 'YYYY-MM'
  movements: Movement[]
  displayName: string
  giro?: string
}

export function MonthlyReportDoc({ month, movements, displayName, giro }: MonthlyReportDocProps) {
  // Month label
  const [year, mon] = month.split('-').map(Number)
  const monthTitle = (() => {
    const raw = new Date(year, mon - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  // Breakdowns by category (exclude investments from P&L)
  const incomeByCategory: CategoryMap = {}
  const expenseByCategory: CategoryMap = {}
  let totalIncome = 0
  let totalExpenses = 0

  for (const m of movements) {
    if (m.isInvestment) continue
    if (m.type === 'ingreso') {
      incomeByCategory[m.category] = (incomeByCategory[m.category] ?? 0) + m.amount
      totalIncome += m.amount
    } else if (m.type === 'gasto') {
      expenseByCategory[m.category] = (expenseByCategory[m.category] ?? 0) + m.amount
      totalExpenses += m.amount
    }
  }

  const net = totalIncome - totalExpenses
  const netPositive = net >= 0

  // Sort categories by amount desc
  const incomeEntries = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1])
  const expenseEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])

  // Sort movements by date desc
  const sorted = [...movements].sort((a, b) =>
    b.movementDate.localeCompare(a.movementDate) || a.description.localeCompare(b.description)
  )

  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Document>
      {/* ── PAGE 1: Estado de Resultados ── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerMonth}>{monthTitle}</Text>
          <Text style={s.headerBusiness}>{displayName}</Text>
          {giro && <Text style={s.headerSub}>{giro}</Text>}
          <Text style={s.headerSub}>Estado de Resultados</Text>
        </View>

        {/* Summary pills */}
        <Text style={s.sectionTitle}>Resumen</Text>
        <View style={s.pillRow}>
          <View style={[s.pill, { backgroundColor: BRAND_LIME, border: `1pt solid ${BRAND_LIGHT}` }]}>
            <Text style={[s.pillLabel, { color: BRAND }]}>Ingresos</Text>
            <Text style={[s.pillAmount, { color: BRAND }]}>{fmt(totalIncome)}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: DANGER_BG, border: `1pt solid ${DANGER_BORDER}` }]}>
            <Text style={[s.pillLabel, { color: DANGER }]}>Gastos</Text>
            <Text style={[s.pillAmount, { color: DANGER }]}>{fmt(totalExpenses)}</Text>
          </View>
          <View style={[s.pill, {
            backgroundColor: netPositive ? BRAND_LIME : DANGER_BG,
            border: `1pt solid ${netPositive ? BRAND_LIGHT : DANGER_BORDER}`,
          }]}>
            <Text style={[s.pillLabel, { color: netPositive ? BRAND : DANGER }]}>Neto</Text>
            <Text style={[s.pillAmount, { color: netPositive ? BRAND : DANGER }]}>
              {netPositive ? '+' : '−'}{fmt(Math.abs(net))}
            </Text>
          </View>
        </View>

        {/* Income breakdown */}
        {incomeEntries.length > 0 && (
          <View style={s.breakdownBlock}>
            <Text style={s.sectionTitle}>Desglose de ingresos</Text>
            <View style={[s.breakdownHeader, { backgroundColor: BRAND_LIME }]}>
              <Text style={[s.breakdownHeaderText, { color: BRAND }]}>Categoría</Text>
              <Text style={[s.breakdownHeaderText, { color: BRAND }]}>Monto</Text>
            </View>
            {incomeEntries.map(([cat, amt], i) => (
              <View key={cat} style={i % 2 === 0 ? s.breakdownRow : s.breakdownAlt}>
                <Text style={s.breakdownLabel}>{cat}</Text>
                <Text style={[s.breakdownAmt, { color: BRAND }]}>{fmt(amt)}</Text>
              </View>
            ))}
            <View style={s.breakdownTotal}>
              <Text style={s.breakdownTotalLabel}>Total ingresos</Text>
              <Text style={[s.breakdownTotalAmt, { color: BRAND }]}>{fmt(totalIncome)}</Text>
            </View>
          </View>
        )}

        {/* Expense breakdown */}
        {expenseEntries.length > 0 && (
          <View style={s.breakdownBlock}>
            <Text style={s.sectionTitle}>Desglose de gastos</Text>
            <View style={[s.breakdownHeader, { backgroundColor: DANGER_BG }]}>
              <Text style={[s.breakdownHeaderText, { color: DANGER }]}>Categoría</Text>
              <Text style={[s.breakdownHeaderText, { color: DANGER }]}>Monto</Text>
            </View>
            {expenseEntries.map(([cat, amt], i) => (
              <View key={cat} style={i % 2 === 0 ? s.breakdownRow : s.breakdownAlt}>
                <Text style={s.breakdownLabel}>{cat}</Text>
                <Text style={[s.breakdownAmt, { color: DANGER }]}>{fmt(amt)}</Text>
              </View>
            ))}
            <View style={s.breakdownTotal}>
              <Text style={s.breakdownTotalLabel}>Total gastos</Text>
              <Text style={[s.breakdownTotalAmt, { color: DANGER }]}>{fmt(totalExpenses)}</Text>
            </View>
          </View>
        )}

        {/* Net result */}
        <View style={[s.netRow, {
          backgroundColor: netPositive ? BRAND_LIME : DANGER_BG,
          border: `1pt solid ${netPositive ? BRAND_LIGHT : DANGER_BORDER}`,
        }]}>
          <Text style={[s.netLabel, { color: netPositive ? BRAND : DANGER }]}>Resultado neto</Text>
          <Text style={[s.netAmount, { color: netPositive ? BRAND : DANGER }]}>
            {netPositive ? '+' : '−'}{fmt(Math.abs(net))}
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generado con Fiza · fiza.mx</Text>
          <Text style={s.footerText}>{today}</Text>
        </View>
      </Page>

      {/* ── PAGE 2+: Movimientos ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Minimal header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: `1pt solid ${BRAND_BORDER}`, paddingBottom: 8 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND }}>Movimientos</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND }}>{displayName}</Text>
            <Text style={{ fontSize: 8, color: MUTED }}>{monthTitle}</Text>
          </View>
        </View>

        <View style={s.tableHeader}>
          <Text style={[s.cellHeader, s.colDate]}>Fecha</Text>
          <Text style={[s.cellHeader, s.colDesc]}>Descripción</Text>
          <Text style={[s.cellHeader, s.colCat]}>Categoría</Text>
          <Text style={[s.cellHeader, s.colType]}>Tipo</Text>
          <Text style={[s.cellHeader, s.colAmt]}>Monto</Text>
        </View>

        {sorted.map((m, i) => {
          const isIncome = m.type === 'ingreso'
          const isPending = m.type === 'pendiente'
          const amountColor = isIncome ? BRAND : isPending ? MUTED : DANGER
          const Row = i % 2 === 0 ? s.tableRow : s.tableRowAlt
          return (
            <View key={m.id} style={Row}>
              <Text style={[s.cellMuted, s.colDate]}>{fmtDate(m.movementDate)}</Text>
              <Text style={[s.cellText, s.colDesc]}>{m.description}</Text>
              <Text style={[s.cellMuted, s.colCat]}>{m.category}</Text>
              <Text style={[s.cellMuted, s.colType]}>{capitalize(m.type)}</Text>
              <Text style={[s.cellText, s.colAmt, { color: amountColor, fontFamily: 'Helvetica-Bold' }]}>
                {isIncome ? '+' : isPending ? '' : '−'}{fmt(m.amount)}
              </Text>
            </View>
          )
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generado con Fiza · fiza.mx</Text>
          <Text style={s.footerText}>{today}</Text>
        </View>
      </Page>
    </Document>
  )
}
