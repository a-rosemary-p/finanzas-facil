'use client'

/**
 * RecentMovements — lista de los últimos movimientos registrados, ordenados
 * por `created_at DESC` (no por `movement_date`).
 *
 * Sirve como espejo de "verifica que tu registro reciente se guardó". Por eso
 * NO está conectado al filtro de período del card de métricas — el user puede
 * estar viendo "Año" en métricas y aquí seguir viendo el último mov que metió
 * hace 30 segundos.
 *
 * Comportamiento (acordado abr 2026):
 *  - Default: 5 movimientos.
 *  - Click "Mostrar más" → expande a 10.
 *  - Otro click (ya con 10) → navega a `/reportes` (el explorador completo).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { MOVEMENT_TYPE_CONFIG } from '@/lib/constants'
import { IconArrowRight } from '@/components/icons'
import type { Movement } from '@/types'

interface Props {
  /** Bump para forzar refetch (después de registrar un nuevo mov). */
  refreshKey?: number
}

const PAGE_SIZE = 10

export function RecentMovements({ refreshKey = 0 }: Props) {
  const router = useRouter()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWithAuthRetry(`/api/movements?sort=recent&pageSize=${PAGE_SIZE}`)
      .then(r => r.json())
      .then((d: { movements?: Movement[] }) => {
        if (!cancelled) {
          setMovements(d.movements ?? [])
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const visible = expanded ? movements : movements.slice(0, 5)
  const hasMore = movements.length > 5
  const allShown = expanded || movements.length <= 5

  return (
    <div>
      <div className="text-[12px] font-bold uppercase mb-2.5"
        style={{ letterSpacing: '0.08em', color: 'var(--ink-500)' }}>
        Últimos movimientos
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: 'var(--brand-mid)' }}>Cargando...</div>
      ) : movements.length === 0 ? (
        <div
          className="rounded-xl px-4 py-6 text-center"
          style={{
            background: 'rgba(255,255,255,0.6)',
            border: '1px dashed var(--brand-border)',
            color: 'var(--brand-mid)',
          }}
        >
          <p className="text-sm">Aún no has registrado movimientos.</p>
          <p className="text-xs mt-1" style={{ opacity: 0.8 }}>
            Empieza por arriba con foto, voz o escribiendo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map(m => (
            <RecentRow key={m.id} mov={m} />
          ))}
        </div>
      )}

      {/* Mostrar más / Ver todos */}
      {!loading && hasMore && (
        <div className="mt-3">
          {!allShown ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full rounded-xl text-sm font-semibold transition-colors"
              style={{
                height: 44,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid var(--brand-border)',
                color: 'var(--brand)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Mostrar más
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/reportes')}
              className="w-full rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ height: 44, background: 'var(--brand)' }}
            >
              Ver todos los movimientos
              <IconArrowRight size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RecentRow({ mov }: { mov: Movement }) {
  const cfg = MOVEMENT_TYPE_CONFIG[mov.type]
  const sign = mov.type === 'ingreso' ? '+' : mov.type === 'gasto' ? '−' : ''

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl bg-white"
      style={{
        border: '1px solid var(--brand-border)',
        boxShadow: 'var(--sh-1)',
        padding: '10px 12px',
      }}
    >
      <span
        className="text-[9px] font-bold uppercase rounded-md flex-shrink-0"
        style={{
          letterSpacing: '0.1em',
          padding: '4px 7px',
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
        }}
      >
        {cfg.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--ink-900)' }}>
          {mov.description}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-300)' }}>
          {formatRelative(mov.movementDate)}
        </div>
      </div>
      <span
        className="text-[15px] font-bold tabular-nums flex-shrink-0"
        style={{ color: cfg.color }}
      >
        {sign}{formatCurrency(mov.amount).replace('$', '$')}
      </span>
    </div>
  )
}

/** "Hoy", "Ayer", o "12 abr" — versión compacta para la fila. */
function formatRelative(ymd: string): string {
  const today = new Date()
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (ymd === todayYMD) return 'Hoy'

  const y = today.getFullYear(); const m = today.getMonth(); const d = today.getDate()
  const yest = new Date(y, m, d - 1)
  const yestYMD = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`
  if (ymd === yestYMD) return 'Ayer'

  const [yy, mm, dd] = ymd.split('-').map(Number)
  if (!yy || !mm || !dd) return ymd
  const date = new Date(yy, mm - 1, dd)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
