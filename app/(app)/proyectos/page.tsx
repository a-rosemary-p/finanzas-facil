'use client'

/**
 * /proyectos — lista de proyectos del user (v0.5, Pro-only).
 *
 * Tabs Activos / Archivados. Cada card muestra name, client, neto en color
 * según rentabilidad, count de movs. Ordenado por última actividad desc
 * (lo hace el endpoint con max(movement_date, updated_at)).
 *
 * Para Free: muestra estado teaser con CTA de upgrade. No mostramos la
 * lista real porque no debería tener proyectos.
 *
 * Empty state: explicación breve del feature + botón crear el primero.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/app-header'
import { useAuth } from '@/hooks/use-auth'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { track } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import { IconFolder, IconLock, IconPlus } from '@/components/icons'
import { NewProjectInlineForm } from '@/components/projects/new-project-inline-form'
import { ProjectsOnboardingModal } from '@/components/projects/projects-onboarding-modal'
import type { ProjectWithSummary, Project } from '@/types'

type ProjectStatusFilter = 'active' | 'archived'

export default function ProyectosPage() {
  const { profile, loading: authLoading } = useAuth()
  const isPro = profile?.plan === 'pro'

  const [filter, setFilter] = useState<ProjectStatusFilter>('active')
  const [projects, setProjects] = useState<ProjectWithSummary[]>([])
  const [cap, setCap] = useState(10)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  async function load() {
    if (!isPro) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/projects?status=${filter}`, { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { projects: ProjectWithSummary[]; cap: number }
      setProjects(data.projects ?? [])
      setCap(data.cap ?? 10)
    } catch (err) {
      console.error('[proyectos] load failed', err)
      setError('No se pudo cargar la lista.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPro, filter])

  const activeCount = filter === 'active' ? projects.length : 0
  const atCap = filter === 'active' && activeCount >= cap

  // ── Teaser para Free ──────────────────────────────────────────────────
  if (!authLoading && profile && !isPro) {
    return (
      <div className="min-h-screen fz-page-gradient">
        <AppHeader />
        <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6 fz-pad-safe-bottom">
          <div>
            <h1 className="font-bold text-lg text-brand flex items-center gap-2">
              <IconFolder size={18} /> Proyectos
            </h1>
            <p className="text-sm mt-0.5 text-brand-mid">
              Disponible en plan Pro.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-brand-border flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconLock />
              <h2 className="font-bold text-base text-brand">Mide la rentabilidad de cada cliente</h2>
            </div>
            <p className="text-sm text-brand-mid leading-relaxed">
              Los proyectos agrupan ingresos y gastos por cliente o trabajo para que
              veas <strong>cuánto realmente ganaste</strong> en cada uno. Ideal para
              freelancers que cobran por trabajo terminado.
            </p>
            <ul className="text-sm text-brand-mid flex flex-col gap-1.5 pl-4 list-disc">
              <li>La IA detecta el proyecto al registrar (&ldquo;cobré 5000 de Martínez&rdquo;)</li>
              <li>Ingresos − gastos y margen % por proyecto</li>
              <li>Hasta 10 proyectos activos a la vez</li>
              <li>Archiva al terminar — la historia queda</li>
            </ul>
            <button
              onClick={() => {
                track('projects_teaser_clicked', { source: 'projects_page' })
                startProCheckout()
              }}
              className="mt-2 w-full text-white rounded-xl py-3 font-bold text-sm bg-brand"
            >
              Actualizar a Pro
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5 fz-pad-safe-bottom">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h1 className="font-bold text-lg text-brand flex items-center gap-2">
              <IconFolder size={18} /> Proyectos
            </h1>
            <p className="text-sm mt-0.5 text-brand-mid">
              Agrupa movimientos por cliente o trabajo y mide la rentabilidad.
            </p>
          </div>
          {/* Botón help "?" — abre el mismo modal de onboarding pero sin marcar
            * como visto. Para que el user pueda repasar las reglas cuando quiera. */}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="w-8 h-8 rounded-full border border-brand-border text-brand-mid text-sm font-bold flex items-center justify-center shrink-0"
            aria-label="Ayuda sobre proyectos"
            title="¿Cómo funcionan los proyectos?"
          >
            ?
          </button>
        </div>

        {/* Tabs Activos / Archivados */}
        <div className="flex gap-1 p-1 rounded-lg bg-brand-chip border border-brand-border">
          {(['active', 'archived'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={[
                'flex-1 text-xs font-bold rounded-md py-1.5 transition-colors',
                filter === opt ? 'bg-brand text-white' : 'bg-transparent text-brand-mid',
              ].join(' ')}
            >
              {opt === 'active' ? 'Activos' : 'Archivados'}
            </button>
          ))}
        </div>

        {/* Botón crear + form inline (solo en tab Activos) */}
        {filter === 'active' && (
          <div>
            {!showForm ? (
              <button
                onClick={() => {
                  if (atCap) {
                    setError(`Llegaste al tope de ${cap} proyectos activos. Archiva uno antes de crear otro.`)
                    return
                  }
                  setError('')
                  setShowForm(true)
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-brand text-brand bg-white transition-colors flex items-center justify-center gap-1.5"
              >
                <IconPlus size={16} />
                Nuevo proyecto
              </button>
            ) : (
              <NewProjectInlineForm
                onCancel={() => setShowForm(false)}
                onCreated={(_p: Project) => {
                  setShowForm(false)
                  void load()
                }}
              />
            )}
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-2 bg-white rounded-xl shadow-sm p-3.5 border border-brand-border">
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={() => { setError(''); void load() }}
              className="text-xs font-bold text-brand text-left"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Lista — solo mostramos empty state si NO hubo error. Mezclar
          * los dos confunde al user ("no se cargó" + "crea el primero"). */}
        {loading ? (
          <p className="text-sm text-brand-mid">Cargando…</p>
        ) : error ? null : projects.length === 0 ? (
          <EmptyState
            filter={filter}
            onCreate={() => setShowForm(true)}
            onSwitchToActive={() => setFilter('active')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>

      {/* Help modal (manual, NO marca onboarded) */}
      {showHelp && (
        <ProjectsOnboardingModal
          markSeenOnClose={false}
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectWithSummary }) {
  const net = project.summary.net
  const netColor = net > 0 ? 'text-brand' : net < 0 ? 'text-danger' : 'text-brand-mid'
  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="bg-white rounded-xl shadow-sm p-3.5 border border-brand-border flex flex-col gap-1.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-brand truncate">{project.name}</p>
          {project.clientName && (
            <p className="text-xs text-brand-mid truncate">{project.clientName}</p>
          )}
        </div>
        <div className={`font-bold text-sm whitespace-nowrap ${netColor}`}>
          {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-brand-mid">
        <span>+{formatCurrency(project.summary.income)}</span>
        <span>−{formatCurrency(project.summary.expenses)}</span>
        <span className="ml-auto">
          {project.summary.movementCount} mov{project.summary.movementCount !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ filter, onCreate, onSwitchToActive }: { filter: ProjectStatusFilter; onCreate: () => void; onSwitchToActive: () => void }) {
  if (filter === 'archived') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-brand-border flex flex-col gap-2 items-center text-center">
        <p className="text-sm text-brand-mid">No tienes proyectos archivados.</p>
        <button
          onClick={onSwitchToActive}
          className="text-xs font-bold text-brand"
        >
          ← Ver activos
        </button>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-brand-border flex flex-col gap-3 items-center text-center">
      <IconFolder size={28} />
      <div>
        <p className="font-bold text-sm text-brand">Crea tu primer proyecto</p>
        <p className="text-xs text-brand-mid mt-1 leading-relaxed">
          Agrupa los movimientos de un cliente o trabajo para saber cuánto realmente ganaste.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="text-white rounded-xl py-2 px-4 font-bold text-sm bg-brand"
      >
        Crear proyecto
      </button>
    </div>
  )
}
