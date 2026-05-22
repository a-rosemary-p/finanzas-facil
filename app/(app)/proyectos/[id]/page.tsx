'use client'

/**
 * /proyectos/[id] — detalle del proyecto (v0.5, Pro-only).
 *
 * Header con name, client, status badge, menú "..." con acciones (editar,
 * archivar/reabrir, eliminar). Debajo: 3 metric cards (ingresos, gastos, neto
 * con margen %), chart simple por mes/semana, y lista de movimientos del
 * proyecto.
 *
 * Acciones destructivas requieren confirmación:
 *   - Archivar: 1 click + diálogo (avisa qué pasa con pendientes + recurrentes).
 *   - Reabrir: 1 click directo (puede fallar si llegó al tope).
 *   - Eliminar: 2 clicks (primera vez muestra "¿Seguro?", segunda ejecuta).
 *
 * Si el user es Free, redirect a /inicio (no debería tener proyectos).
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/app-header'
import { useAuth } from '@/hooks/use-auth'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { formatCurrency } from '@/lib/utils'
import { IconFolder, IconArrowRight } from '@/components/icons'
import { ProjectActionsMenu } from '@/components/projects/project-actions-menu'
import { EditProjectModal } from '@/components/projects/edit-project-modal'
import { ProjectChart } from '@/components/projects/project-chart'
import type { Project, ProjectSummary, ProjectTimeseriesPoint, Movement } from '@/types'

interface DetailResponse {
  project: Project
  summary: ProjectSummary
  chart: {
    granularity: 'week' | 'month'
    points: ProjectTimeseriesPoint[]
  }
}

export default function ProyectoDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const isPro = profile?.plan === 'pro'

  const [data, setData] = useState<DetailResponse | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  async function load() {
    if (!params.id || !isPro) return
    setLoading(true)
    setError('')
    try {
      const [detailRes, movsRes] = await Promise.all([
        fetchWithAuthRetry(`/api/projects/${params.id}`, { method: 'GET' }),
        // filter=all: queremos TODA la historia del proyecto, no del mes actual.
        // El detail page es Pro-only y aquí no hay límite Free (no se renderea
        // si !isPro). pageSize=200 cubre proyectos largos sin paginación inicial.
        fetchWithAuthRetry(`/api/movements?projectId=${params.id}&filter=all&pageSize=200`, { method: 'GET' }),
      ])
      if (!detailRes.ok) {
        if (detailRes.status === 404) {
          setError('Proyecto no encontrado')
        } else {
          setError(`Error (${detailRes.status})`)
        }
        return
      }
      const d = (await detailRes.json()) as DetailResponse
      setData(d)
      if (movsRes.ok) {
        const md = (await movsRes.json()) as { movements: Movement[] }
        setMovements(md.movements ?? [])
      }
    } catch (err) {
      console.error('[proyecto detail] load failed', err)
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (profile && !isPro) {
        // /proyectos muestra el teaser dedicado del feature. /inicio sería
        // tirar al user sin contexto del por qué.
        router.replace('/proyectos')
        return
      }
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPro, params.id])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen fz-page-gradient">
        <AppHeader />
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-sm text-brand-mid">Cargando…</p>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen fz-page-gradient">
        <AppHeader />
        <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
          <p className="text-sm text-danger">{error || 'No se encontró el proyecto'}</p>
          <Link href="/proyectos" className="text-sm font-bold text-brand">
            ← Volver a Proyectos
          </Link>
        </main>
      </div>
    )
  }

  const { project, summary, chart } = data
  const isArchived = project.status === 'archived'
  const netColor = summary.net > 0 ? 'text-brand' : summary.net < 0 ? 'text-danger' : 'text-brand-mid'

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5 fz-pad-safe-bottom">
        <Link href="/proyectos" className="text-xs font-medium text-brand-mid flex items-center gap-1">
          ← Proyectos
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-brand flex items-center gap-2">
              <IconFolder size={18} />
              <span className="truncate">{project.name}</span>
              {isArchived && (
                <span className="text-[10px] font-bold uppercase bg-paper-2 text-brand-mid px-1.5 py-0.5 rounded">
                  Archivado
                </span>
              )}
            </h1>
            {project.clientName && (
              <p className="text-sm text-brand-mid mt-0.5">{project.clientName}</p>
            )}
          </div>
          <ProjectActionsMenu
            project={project}
            onEdit={() => setEditing(true)}
            onArchived={load}
            onReopened={load}
            onDeleted={() => router.replace('/proyectos')}
          />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCell label="Ingresos" value={summary.income} tone="income" />
          <MetricCell label="Gastos" value={summary.expenses} tone="expense" />
          <div className="bg-white rounded-xl shadow-sm p-3 border border-brand-border flex flex-col gap-0.5">
            <p className="text-[10px] font-bold uppercase text-brand-mid">Neto</p>
            <p className={`text-sm font-bold ${netColor}`}>
              {summary.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(summary.net))}
            </p>
            {summary.marginPct !== null ? (
              <p className="text-[10px] text-brand-mid">
                {summary.marginPct >= 0 ? '+' : ''}{(summary.marginPct * 100).toFixed(0)}% margen
              </p>
            ) : (
              <p className="text-[10px] text-brand-mid">Sin ingresos aún</p>
            )}
          </div>
        </div>

        {/* Notas (si tiene) */}
        {project.notes && (
          <div className="bg-white rounded-xl shadow-sm p-3.5 border border-brand-border">
            <p className="text-[10px] font-bold uppercase mb-1 text-brand-mid">Notas</p>
            <p className="text-sm text-brand whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}

        {/* Chart */}
        {chart.points.length > 0 && (
          <ProjectChart granularity={chart.granularity} points={chart.points} />
        )}

        {/* Movimientos del proyecto */}
        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-sm text-brand">
            Movimientos {movements.length > 0 && `(${movements.length})`}
          </h2>
          {movements.length === 0 ? (
            <p className="text-sm text-brand-mid">
              Aún no hay movimientos en este proyecto. Al registrar uno menciona
              el nombre del proyecto y la IA lo asigna automáticamente.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {movements.map(m => (
                <MovementRow key={m.id} mov={m} />
              ))}
            </div>
          )}
        </section>
      </main>

      {editing && (
        <EditProjectModal
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function MetricCell({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' }) {
  const colorClass = tone === 'income' ? 'text-income-text' : 'text-expense-text'
  const sign = tone === 'income' ? '+' : '−'
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 border border-brand-border flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase text-brand-mid">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{sign}{formatCurrency(value)}</p>
    </div>
  )
}

function MovementRow({ mov }: { mov: Movement }) {
  const sign = mov.type === 'ingreso' ? '+' : mov.type === 'gasto' ? '−' : '∼'
  const color = mov.type === 'ingreso' ? 'text-brand' : mov.type === 'gasto' ? 'text-danger' : 'text-brand-mid'
  return (
    <Link
      href={`/movimientos`}
      className="bg-white rounded-lg shadow-sm px-3 py-2 border border-brand-border flex items-center gap-2"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand truncate">{mov.description}</p>
        <p className="text-[11px] text-brand-mid">{mov.category} · {mov.movementDate}</p>
      </div>
      <div className={`font-bold text-sm whitespace-nowrap ${color}`}>
        {sign}{formatCurrency(mov.amount)}
      </div>
      <IconArrowRight size={14} />
    </Link>
  )
}
