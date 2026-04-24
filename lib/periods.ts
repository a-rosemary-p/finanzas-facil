// lib/periods.ts
// Helpers para los 4 modos de período de la pantalla /reportes:
//   week    — lunes a domingo
//   month   — calendario, 1 al último día
//   quarter — trimestre calendario (Q1=Ene-Mar, Q2=Abr-Jun, etc.)
//   year    — año calendario
//
// Para Free solo se usa "month"; los pills de cambio de modo solo aparecen para Pro.

import { PLANS } from '@/lib/constants'
import type { Plan } from '@/types'

export type PeriodMode = 'week' | 'month' | 'quarter' | 'year'

export interface PeriodSelection {
  mode: PeriodMode
  /** Cualquier fecha dentro del período. La función calcula el rango real. */
  anchor: string  // YYYY-MM-DD
}

// ── Conversión Date ↔ string ────────────────────────────────────────────────
export function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseYMD(s: string): Date {
  // T12:00:00 evita drift por DST cuando ronda medianoche
  return new Date(s + 'T12:00:00')
}

// ── Boundaries ──────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  // Lunes = 1, Domingo = 0. Movemos a lunes de esa semana.
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + offset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export function periodRange(p: PeriodSelection): { start: string; end: string } {
  const a = parseYMD(p.anchor)
  switch (p.mode) {
    case 'week': {
      const start = startOfWeek(a)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { start: fmtYMD(start), end: fmtYMD(end) }
    }
    case 'month': {
      const start = new Date(a.getFullYear(), a.getMonth(), 1)
      const end = new Date(a.getFullYear(), a.getMonth() + 1, 0)
      return { start: fmtYMD(start), end: fmtYMD(end) }
    }
    case 'quarter': {
      const qStartMonth = Math.floor(a.getMonth() / 3) * 3
      const start = new Date(a.getFullYear(), qStartMonth, 1)
      const end = new Date(a.getFullYear(), qStartMonth + 3, 0)
      return { start: fmtYMD(start), end: fmtYMD(end) }
    }
    case 'year': {
      const start = new Date(a.getFullYear(), 0, 1)
      const end = new Date(a.getFullYear(), 11, 31)
      return { start: fmtYMD(start), end: fmtYMD(end) }
    }
  }
}

// ── Navegación ──────────────────────────────────────────────────────────────
export function prevPeriod(p: PeriodSelection): PeriodSelection {
  const a = parseYMD(p.anchor)
  switch (p.mode) {
    case 'week': a.setDate(a.getDate() - 7); break
    case 'month': a.setMonth(a.getMonth() - 1); break
    case 'quarter': a.setMonth(a.getMonth() - 3); break
    case 'year': a.setFullYear(a.getFullYear() - 1); break
  }
  return { mode: p.mode, anchor: fmtYMD(a) }
}

export function nextPeriod(p: PeriodSelection): PeriodSelection {
  const a = parseYMD(p.anchor)
  switch (p.mode) {
    case 'week': a.setDate(a.getDate() + 7); break
    case 'month': a.setMonth(a.getMonth() + 1); break
    case 'quarter': a.setMonth(a.getMonth() + 3); break
    case 'year': a.setFullYear(a.getFullYear() + 1); break
  }
  return { mode: p.mode, anchor: fmtYMD(a) }
}

export function todayPeriod(mode: PeriodMode): PeriodSelection {
  return { mode, anchor: fmtYMD(new Date()) }
}

// ── Labels para UI / PDF ─────────────────────────────────────────────────────
const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const LONG_MONTHS_ES  = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function periodLabel(p: PeriodSelection): string {
  const r = periodRange(p)
  const sd = parseYMD(r.start)
  const ed = parseYMD(r.end)

  switch (p.mode) {
    case 'week': {
      const sMon = SHORT_MONTHS_ES[sd.getMonth()]
      const eMon = SHORT_MONTHS_ES[ed.getMonth()]
      const y = ed.getFullYear()
      if (sd.getMonth() === ed.getMonth()) {
        return `${sd.getDate()} – ${ed.getDate()} ${eMon} ${y}`
      }
      return `${sd.getDate()} ${sMon} – ${ed.getDate()} ${eMon} ${y}`
    }
    case 'month': {
      return `${cap(LONG_MONTHS_ES[sd.getMonth()])} ${sd.getFullYear()}`
    }
    case 'quarter': {
      const q = Math.floor(sd.getMonth() / 3) + 1
      return `Trimestre ${q} · ${sd.getFullYear()}`
    }
    case 'year': {
      return `${sd.getFullYear()}`
    }
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Slug seguro para nombre de archivo (sin espacios ni caracteres raros).
// Ej: "2026-04", "2026-W17-abr14_20", "2026-Q2", "2026"
export function periodSlug(p: PeriodSelection): string {
  const r = periodRange(p)
  const sd = parseYMD(r.start)
  const ed = parseYMD(r.end)
  switch (p.mode) {
    case 'week':    return `${sd.getFullYear()}-${SHORT_MONTHS_ES[sd.getMonth()]}${sd.getDate()}_${ed.getDate()}`
    case 'month':   return `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}`
    case 'quarter': return `${sd.getFullYear()}-Q${Math.floor(sd.getMonth() / 3) + 1}`
    case 'year':    return `${sd.getFullYear()}`
  }
}

// Label corto para el PDF y otros contextos donde el largo no cabe
export function periodLabelShort(p: PeriodSelection): string {
  const r = periodRange(p)
  const sd = parseYMD(r.start)
  const ed = parseYMD(r.end)
  switch (p.mode) {
    case 'week': {
      const sMon = SHORT_MONTHS_ES[sd.getMonth()]
      const eMon = SHORT_MONTHS_ES[ed.getMonth()]
      if (sd.getMonth() === ed.getMonth()) return `${sd.getDate()}–${ed.getDate()} ${eMon} ${ed.getFullYear()}`
      return `${sd.getDate()} ${sMon} – ${ed.getDate()} ${eMon} ${ed.getFullYear()}`
    }
    case 'month':   return periodLabel(p)
    case 'quarter': return `T${Math.floor(sd.getMonth() / 3) + 1} ${sd.getFullYear()}`
    case 'year':    return periodLabel(p)
  }
}

// ── Validación de plan ──────────────────────────────────────────────────────

/**
 * El anchor más viejo permitido para Free. Solo aplica al modo 'month' (Free no
 * tiene acceso a los otros modos). null = sin restricción (Pro).
 */
export function earliestAllowed(plan: Plan, mode: PeriodMode): string | null {
  if (plan === 'pro') return null
  if (mode !== 'month') return null  // no aplica — Free no tiene esos modos
  const today = new Date()
  const earliest = new Date(today.getFullYear(), today.getMonth() - (PLANS.FREE.historyMonths - 1), 1)
  return fmtYMD(earliest)
}

/** True si el período pedido cae dentro de lo que Free puede ver. */
export function isAccessibleForFree(p: PeriodSelection): boolean {
  if (p.mode !== 'month') return false  // Free es month-only
  const earliest = earliestAllowed('free', 'month')
  if (!earliest) return true
  const range = periodRange(p)
  return range.start >= earliest
}

/** True si el período cae completamente en el futuro. */
export function isFuturePeriod(p: PeriodSelection): boolean {
  const today = fmtYMD(new Date())
  return periodRange(p).start > today
}
