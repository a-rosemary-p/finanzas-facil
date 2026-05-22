'use client'

/**
 * Hook client-side para cargar la lista de proyectos activos del user
 * (v0.5 Pro). Patrón simple: fetch on-mount, cache en estado local.
 *
 * Si el user es Free, no hace fetch (devuelve list vacía + isPro=false).
 * El consumidor decide qué mostrar (teaser, dropdown, etc.).
 *
 * `refetch` se llama cuando la UI sabe que un proyecto pudo haber cambiado
 * (ej. después de crear uno inline en /confirmation).
 *
 * `addProject` (optimistic update): inyecta un proyecto recién creado a la
 * lista sin re-fetch, para que el selector reaccione inmediatamente.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { ProjectWithSummary, Project } from '@/types'

interface UseProjectsResult {
  projects: ProjectWithSummary[]
  loading: boolean
  isPro: boolean
  refetch: () => Promise<void>
  addProject: (proj: Project) => void
}

export function useProjects(opts: { isPro: boolean; enabled?: boolean } = { isPro: false }): UseProjectsResult {
  const { isPro, enabled = true } = opts
  const [projects, setProjects] = useState<ProjectWithSummary[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!isPro || !enabled) return
    setLoading(true)
    try {
      const res = await fetchWithAuthRetry('/api/projects?status=active', { method: 'GET' })
      if (res.ok) {
        const data = (await res.json()) as { projects: ProjectWithSummary[] }
        setProjects(data.projects ?? [])
      }
    } catch (err) {
      console.error('[useProjects] fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [isPro, enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  const addProject = useCallback((proj: Project) => {
    setProjects(prev => {
      // Si ya existe, no duplicar.
      if (prev.some(p => p.id === proj.id)) return prev
      // Insertar al principio (más reciente) con summary vacío.
      const withEmpty: ProjectWithSummary = {
        ...proj,
        summary: {
          projectId: proj.id,
          income: 0,
          expenses: 0,
          net: 0,
          marginPct: null,
          movementCount: 0,
          lastActivityAt: proj.updatedAt,
        },
      }
      return [withEmpty, ...prev]
    })
  }, [])

  return { projects, loading, isPro, refetch, addProject }
}
