'use client'

/**
 * ProjectsRanking — Top de proyectos por net del período en /reportes.
 * (v0.63 — Pro only). Vive en la pestaña "Este período" debajo de las donas.
 *
 * Solo renderea cuando:
 *   - User es Pro
 *   - El chip de proyecto activo está en "General" (sino sería redundante
 *     con la vista filtrada a UN proyecto — el ranking compara entre varios).
 *   - Hay al menos un proyecto con movs en el período.
 *
 * Click en un item navega al detalle del proyecto.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { IconFolder, IconArrowRight } from '@/components/icons'
import type { PeriodSelection } from '@/lib/periods'

interface RankingItem {
  projectId: string
  projectName: string
  projectClient: string | null
  projectStatus: 'active' | 'archived'
  income: number
  expenses: number
  net: number
  marginPct: number | null
  movementCount: number
}

interface RankingResponse {
  ranking: RankingItem[]
}

interface Props {
  period: PeriodSelection
  /** Si el chip del header está en un proyecto específico, esconder el ranking. */
  activeProjectId: string | null
  /** Plan del user. Si free, no renderea (es Pro-only). */
  isPro: boolean
}

export function ProjectsRanking({ period, activeProjectId, isPro }: Props) {
  const [items, setItems] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(false)

  const shouldFetch = isPro && !activeProjectId

  useEffect(() => {
    if (!shouldFetch) {
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/reports/projects-ranking?mode=${period.mode}&anchor=${period.anchor}`)
      .then(r => r.json())
      .then((d: RankingResponse) => {
        if (!cancelled) {
          setItems(d.ranking ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [period.mode, period.anchor, shouldFetch])

  // No render si no aplica o si no hay datos.
  if (!shouldFetch) return null
  if (!loading && items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-brand-border p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-brand flex items-center gap-1.5">
          <IconFolder size={14} /> Top proyectos del período
        </h3>
        {items.length > 0 && (
          <span className="text-[10px] text-brand-mid">
            {items.length} con movimientos
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-brand-mid">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, idx) => (
            <RankingRow key={item.projectId} item={item} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function RankingRow({ item, rank }: { item: RankingItem; rank: number }) {
  const isPositive = item.net >= 0
  const netColor = isPositive ? 'text-brand' : 'text-danger'
  const netSign = isPositive ? '+' : '−'
  return (
    <Link
      href={`/proyectos/${item.projectId}`}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-brand-border hover:bg-brand-chip transition-colors"
    >
      <span className="text-[10px] font-bold text-brand-mid w-4 text-center">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-xs text-brand truncate">
            {item.projectName}
          </p>
          {item.projectStatus === 'archived' && (
            <span className="text-[9px] font-bold uppercase bg-paper-2 text-brand-mid px-1 py-0.5 rounded">
              Archivado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-brand-mid mt-0.5">
          <span>+{formatCurrency(item.income)}</span>
          <span>−{formatCurrency(item.expenses)}</span>
          {item.marginPct !== null && (
            <span className="opacity-80">
              {item.marginPct >= 0 ? '+' : ''}{(item.marginPct * 100).toFixed(0)}% margen
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className={`font-bold text-xs whitespace-nowrap ${netColor}`}>
          {netSign}{formatCurrency(Math.abs(item.net))}
        </span>
      </div>
      <IconArrowRight size={12} />
    </Link>
  )
}
