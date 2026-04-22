'use client'

import { useState } from 'react'
import { getPeriodLabel, getTodayString } from '@/lib/utils'
import type { DateFilter } from '@/types'

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7days', label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Histórico' },
]

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface FilterBoxProps {
  filter: DateFilter
  selectedMonth: Date | undefined
  customRange: { from: string; to: string } | null
  plan: 'free' | 'pro'
  onSetFilter: (f: DateFilter) => void
  onSetMonth: (d: Date) => void
  onSetCustomRange: (from: string, to: string) => void
}

export function FilterBox({
  filter, selectedMonth, customRange, plan,
  onSetFilter, onSetMonth, onSetCustomRange,
}: FilterBoxProps) {
  const [expanded, setExpanded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rangePickerOpen, setRangePickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() =>
    selectedMonth ? selectedMonth.getFullYear() : new Date().getFullYear()
  )
  // Estado temporal del range picker antes de aplicar
  const [tempFrom, setTempFrom] = useState(() => customRange?.from ?? '')
  const [tempTo, setTempTo] = useState(() => customRange?.to ?? '')

  const periodLabel = getPeriodLabel(filter, selectedMonth, customRange ?? undefined)
  const currentYear = new Date().getFullYear()
  const today = getTodayString()

  function selectFilter(f: DateFilter) {
    onSetFilter(f)
    setExpanded(false)
    setPickerOpen(false)
    setRangePickerOpen(false)
  }

  function selectMonth(month: number) {
    onSetMonth(new Date(pickerYear, month, 1))
    setPickerOpen(false)
    setExpanded(false)
  }

  function applyCustomRange() {
    if (!tempFrom || !tempTo || tempFrom > tempTo) return
    onSetCustomRange(tempFrom, tempTo)
    setRangePickerOpen(false)
    setExpanded(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--brand-border)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setPickerOpen(v => !v)
            setRangePickerOpen(false)
            if (!expanded) setExpanded(true)
          }}
          className="flex items-center gap-2 text-sm font-bold min-h-[36px]"
          style={{ color: 'var(--brand)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{periodLabel}</span>
        </button>
        <button type="button"
          onClick={() => { setExpanded(v => !v); setPickerOpen(false); setRangePickerOpen(false) }}
          className="p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
          style={{ color: 'var(--brand-mid)', background: 'var(--brand-chip)' }}
          aria-label={expanded ? 'Colapsar filtros' : 'Expandir filtros'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Picker de mes */}
      {pickerOpen && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: '#F0F8E8' }}>
          <div className="flex items-center justify-between py-2">
            <button type="button" onClick={() => setPickerYear(y => y + 1)}
              disabled={pickerYear >= currentYear}
              className="p-1.5 rounded min-h-[36px] min-w-[36px] disabled:opacity-30"
              style={{ color: 'var(--brand-mid)' }}
            >◀</button>
            <span className="text-sm font-bold" style={{ color: 'var(--brand)' }}>{pickerYear}</span>
            <button type="button" onClick={() => setPickerYear(y => y - 1)}
              disabled={pickerYear <= 2023}
              className="p-1.5 rounded min-h-[36px] min-w-[36px] disabled:opacity-30"
              style={{ color: 'var(--brand-mid)' }}
            >▶</button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_ES.map((label, idx) => {
              const isActive = filter === 'month' && selectedMonth &&
                selectedMonth.getMonth() === idx && selectedMonth.getFullYear() === pickerYear
              const isCurrentMonth = !selectedMonth && filter === 'month' &&
                new Date().getMonth() === idx && new Date().getFullYear() === pickerYear
              return (
                <button key={label} type="button" onClick={() => selectMonth(idx)}
                  className="py-2 rounded-lg text-xs font-medium min-h-[36px] transition-colors"
                  style={(isActive || isCurrentMonth)
                    ? { background: 'var(--brand)', color: '#fff' }
                    : { background: 'var(--brand-chip)', color: 'var(--brand-mid)' }
                  }
                >{label}</button>
              )
            })}
          </div>
        </div>
      )}

      {/* Opciones expandidas */}
      {expanded && !pickerOpen && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: '#F0F8E8' }}>
          <div className="flex flex-wrap gap-2 pt-3">
            {DATE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => selectFilter(opt.value)}
                className="px-3 py-2 rounded-full text-sm font-medium border min-h-[40px] transition-colors"
                style={filter === opt.value && opt.value !== 'month'
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : { background: '#fff', color: 'var(--brand-mid)', borderColor: 'var(--brand-border)' }
                }
              >{opt.label}</button>
            ))}

            {/* Rango personalizado — Pro */}
            {plan === 'pro' ? (
              <button
                type="button"
                onClick={() => { setRangePickerOpen(v => !v); setPickerOpen(false) }}
                className="px-3 py-2 rounded-full text-sm font-medium border min-h-[40px] transition-colors"
                style={filter === 'custom'
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : rangePickerOpen
                    ? { background: 'var(--brand-chip)', color: 'var(--brand)', borderColor: 'var(--brand)' }
                    : { background: '#fff', color: 'var(--brand-mid)', borderColor: 'var(--brand-border)' }
                }
              >
                Rango
              </button>
            ) : (
              <span
                className="px-3 py-2 rounded-full text-sm font-medium border min-h-[40px] flex items-center gap-1.5 opacity-40 cursor-not-allowed select-none"
                style={{ background: '#fff', color: 'var(--brand-muted)', borderColor: 'var(--brand-border)' }}
                title="Disponible en Pro"
              >
                Rango
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--brand-chip)', color: 'var(--brand-mid)' }}>
                  Pro
                </span>
              </span>
            )}
          </div>

          {/* Range picker — solo Pro */}
          {rangePickerOpen && plan === 'pro' && (
            <div className="mt-3 flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--brand-border)' }}>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>Desde</label>
                  <input
                    type="date"
                    value={tempFrom}
                    max={tempTo || today}
                    onChange={e => setTempFrom(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[40px]"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>Hasta</label>
                  <input
                    type="date"
                    value={tempTo}
                    min={tempFrom}
                    max={today}
                    onChange={e => setTempTo(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[40px]"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--brand)' }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!tempFrom || !tempTo || tempFrom > tempTo}
                onClick={applyCustomRange}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white min-h-[44px] transition-opacity disabled:opacity-40"
                style={{ background: 'var(--brand)' }}
              >
                Aplicar rango
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
