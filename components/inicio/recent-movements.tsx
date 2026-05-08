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
 *  - Otro click (ya con 10) → navega a `/movimientos` (el explorador completo, v0.29).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { IconArrowRight } from '@/components/icons'
import { MovementCard } from '@/components/entries/entry-card'
import { WaveSection } from '@/components/ui/wave'
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
      <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
        Últimos movimientos
      </div>

      {/* Wave divisor entre el subheader y el contenido — antes vivía
       * arriba del componente en inicio/page.tsx; lo movimos acá para que
       * el subheader respire encima del divisor. */}
      <div className="py-2">
        <WaveSection />
      </div>

      {loading ? (
        <div className="text-xs text-brand-mid">Cargando...</div>
      ) : movements.length === 0 ? (
        <div className="fz-empty-card text-brand-mid">
          <p className="text-sm">Aún no has registrado movimientos.</p>
          <p className="text-xs mt-1 opacity-80">
            Empieza por arriba con foto, voz o escribiendo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map(m => (
            <MovementCard
              key={m.id}
              movement={m}
              onUpdated={updated => setMovements(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDeleted={id => setMovements(prev => prev.filter(x => x.id !== id))}
              hideDate={false}
            />
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
              className="w-full h-11 rounded-xl text-sm font-semibold transition-colors bg-paper-soft border border-brand-border text-brand backdrop-blur-md"
            >
              Mostrar más
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/movimientos')}
              className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 bg-brand"
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

