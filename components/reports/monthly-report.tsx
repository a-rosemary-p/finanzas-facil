// NOTE: Only import via dynamic({ ssr: false }) — react-pdf does not run on the server.
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import type { Movement } from '@/types'

// ── Register Outfit font (loaded from CDN at PDF generation time) ─────────────
Font.register({
  family: 'Outfit',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5/files/outfit-latin-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5/files/outfit-latin-500-normal.woff2',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5/files/outfit-latin-700-normal.woff2',
      fontWeight: 700,
    },
  ],
})

// ── Brand colours ─────────────────────────────────────────────────────────────
const BRAND         = '#578466'
const BRAND_LIGHT   = '#92C3A5'
const BRAND_LIME    = '#DAE68F'
const BRAND_CHIP    = '#F4F6EB'
const BRAND_BORDER  = '#D9E8D0'
const DANGER        = '#D0481A'
const DANGER_BG     = '#FAD5BF'
const DANGER_BORDER = '#F79366'
const MUTED         = '#7A9A88'
const TEXT          = '#1a2e24'

const s = StyleSheet.create({
  /* ── Page ── */
  page: { fontFamily: 'Outfit', fontWeight: 400, fontSize: 9, color: TEXT, padding: '32pt 40pt', backgroundColor: '#FFFFFF' },

  /* ── Header ── */
  header: { alignItems: 'center', paddingBottom: 16, borderBottom: `1.5pt solid ${BRAND}`, marginBottom: 20, gap: 5 },
  headerMonth:    { fontSize: 10, fontWeight: 400, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  headerBusiness: { fontSize: 22, fontWeight: 700, color: BRAND, textAlign: 'center' },
  headerSub:      { fontSize: 9, fontWeight: 400, color: MUTED },

  /* ── Section title ── */
  sectionTitle: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  /* ── Summary pills ── */
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill:    { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 4 },
  pillLabel:  { fontSize: 7,  fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  pillAmount: { fontSize: 16, fontWeight: 700 },

  /* ── Breakdown tables ── */
  breakdownBlock:      { marginBottom: 16 },
  breakdownHeader:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, marginBottom: 1 },
  breakdownHeaderText: { fontSize: 8, fontWeight: 700 },
  breakdownRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5, borderBottom: `0.5pt solid ${BRAND_BORDER}` },
  breakdownAlt:        { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: BRAND_CHIP, borderBottom: `0.5pt solid ${BRAND_BORDER}` },
  breakdownLabel:      { fontSize: 8, fontWeight: 400, color: TEXT },
  breakdownAmt:        { fontSize: 8, fontWeight: 700 },
  breakdownTotal:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, borderTop: `1pt solid ${BRAND_BORDER}`, marginTop: 1 },
  breakdownTotalLabel: { fontSize: 8,  fontWeight: 700, color: TEXT },
  breakdownTotalAmt:   { fontSize: 9, fontWeight: 700 },

  /* ── Net result ── */
  netRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, marginTop: 4 },
  netLabel:  { fontSize: 11, fontWeight: 700 },
  netAmount: { fontSize: 18, fontWeight: 700 },

  /* ── Movement table ── */
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND_LIME, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 2 },
  tableRow:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottom: `0.5pt solid ${BRAND_BORDER}` },
  tableRowAlt: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: BRAND_CHIP, borderBottom: `0.5pt solid ${BRAND_BORDER}` },
  colDate: { width: '11%' },
  colDesc: { width: '40%' },
  colCat:  { width: '18%' },
  colType: { width: '13%' },
  colAmt:  { width: '18%', textAlign: 'right' },
  cellHeader: { fontSize: 8, fontWeight: 700, color: BRAND },
  cellText:   { fontSize: 8, fontWeight: 400, color: TEXT },
  cellMuted:  { fontSize: 8, fontWeight: 400, color: MUTED },

  /* ── Footer ── */
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTop: `0.5pt solid ${BRAND_BORDER}`, paddingTop: 6 },
  footerText: { fontSize: 7, fontWeight: 400, color: MUTED },
  footerLogo: { height: 14, width: 'auto', objectFit: 'contain' },
})

/* ── Helpers ── */
function fmt(n: number): string {
  const abs = Math.abs(n)
  const str = abs >= 1000 ? '$' + Math.round(abs).toLocaleString('en-US') : '$' + abs.toFixed(2)
  return n < 0 ? `−${str}` : str
}
function fmtDate(d: string): string { const [, m, day] = d.split('-'); return `${day}/${m}` }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

type CatMap = Record<string, number>

export interface MonthlyReportDocProps {
  month: string
  movements: Movement[]
  displayName: string
  giro?: string
  logoUrl: string
}

export function MonthlyReportDoc({ month, movements, displayName, giro, logoUrl }: MonthlyReportDocProps) {
  const [year, mon] = month.split('-').map(Number)
  const monthTitle = (() => {
    const raw = new Date(year, mon - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  // Breakdown by category (investments excluded from P&L)
  const incByCat: CatMap = {}
  const expByCat: CatMap = {}
  let totalIncome = 0, totalExpenses = 0
  for (const m of movements) {
    if (m.isInvestment) continue
    if (m.type === 'ingreso') { incByCat[m.category] = (incByCat[m.category] ?? 0) + m.amount; totalIncome += m.amount }
    else if (m.type === 'gasto') { expByCat[m.category] = (expByCat[m.category] ?? 0) + m.amount; totalExpenses += m.amount }
  }
  const net = totalIncome - totalExpenses
  const netPos = net >= 0
  const incEntries = Object.entries(incByCat).sort((a, b) => b[1] - a[1])
  const expEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1])
  const sorted = [...movements].sort((a, b) => b.movementDate.localeCompare(a.movementDate))
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{today}</Text>
      <Image src={logoUrl} style={s.footerLogo} />
    </View>
  )

  return (
    <Document>
      {/* ── PAGE 1: Estado de Resultados ── */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerMonth}>{monthTitle}</Text>
          <Text style={s.headerBusiness}>{displayName}</Text>
          {giro ? <Text style={s.headerSub}>{giro}</Text> : null}
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
          <View style={[s.pill, { backgroundColor: netPos ? BRAND_LIME : DANGER_BG, border: `1pt solid ${netPos ? BRAND_LIGHT : DANGER_BORDER}` }]}>
            <Text style={[s.pillLabel, { color: netPos ? BRAND : DANGER }]}>Neto</Text>
            <Text style={[s.pillAmount, { color: netPos ? BRAND : DANGER }]}>{netPos ? '+' : '−'}{fmt(Math.abs(net))}</Text>
          </View>
        </View>

        {/* Income breakdown */}
        {incEntries.length > 0 && (
          <View style={s.breakdownBlock}>
            <Text style={s.sectionTitle}>Desglose de ingresos</Text>
            <View style={[s.breakdownHeader, { backgroundColor: BRAND_LIME }]}>
              <Text style={[s.breakdownHeaderText, { color: BRAND }]}>Categoría</Text>
              <Text style={[s.breakdownHeaderText, { color: BRAND }]}>Monto</Text>
            </View>
            {incEntries.map(([cat, amt], i) => (
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
        {expEntries.length > 0 && (
          <View style={s.breakdownBlock}>
            <Text style={s.sectionTitle}>Desglose de gastos</Text>
            <View style={[s.breakdownHeader, { backgroundColor: DANGER_BG }]}>
              <Text style={[s.breakdownHeaderText, { color: DANGER }]}>Categoría</Text>
              <Text style={[s.breakdownHeaderText, { color: DANGER }]}>Monto</Text>
            </View>
            {expEntries.map(([cat, amt], i) => (
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
        <View style={[s.netRow, { backgroundColor: netPos ? BRAND_LIME : DANGER_BG, border: `1pt solid ${netPos ? BRAND_LIGHT : DANGER_BORDER}` }]}>
          <Text style={[s.netLabel, { color: netPos ? BRAND : DANGER }]}>Resultado neto</Text>
          <Text style={[s.netAmount, { color: netPos ? BRAND : DANGER }]}>{netPos ? '+' : '−'}{fmt(Math.abs(net))}</Text>
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 2+: Movimientos ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: `1pt solid ${BRAND_BORDER}`, paddingBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: BRAND }}>Movimientos</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, fontWeight: 700, color: BRAND }}>{displayName}</Text>
            <Text style={{ fontSize: 8, fontWeight: 400, color: MUTED }}>{monthTitle}</Text>
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
          const amtColor = isIncome ? BRAND : isPending ? MUTED : DANGER
          const Row = i % 2 === 0 ? s.tableRow : s.tableRowAlt
          return (
            <View key={m.id} style={Row}>
              <Text style={[s.cellMuted, s.colDate]}>{fmtDate(m.movementDate)}</Text>
              <Text style={[s.cellText, s.colDesc]}>{m.description}</Text>
              <Text style={[s.cellMuted, s.colCat]}>{m.category}</Text>
              <Text style={[s.cellMuted, s.colType]}>{cap(m.type)}</Text>
              <Text style={[s.cellText, s.colAmt, { color: amtColor, fontWeight: 700 }]}>
                {isIncome ? '+' : isPending ? '' : '−'}{fmt(m.amount)}
              </Text>
            </View>
          )
        })}

        <Footer />
      </Page>
    </Document>
  )
}
