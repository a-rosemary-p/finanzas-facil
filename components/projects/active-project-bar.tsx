'use client'

/**
 * ActiveProjectBar (v0.61) — barrita debajo del AppHeader que muestra el
 * proyecto activo del Pro user. Click → dropdown con "General" + lista de
 * proyectos activos. Solo se renderea para Pro.
 *
 * Visual: una barra full-width pegada bajo el header, fondo `brand-chip`,
 * texto centrado con folder icon + nombre del proyecto activo (o "General")
 * + chevron. Tap abre dropdown.
 *
 * Auto-reset: si el activeProjectId del localStorage ya no está en la lista
 * de proyectos activos del user (porque se archivó/eliminó), llamamos
 * setActiveProjectId(null) automáticamente.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useProjects } from '@/hooks/use-projects'
import { useActiveProject } from '@/hooks/use-active-project'
import { IconFolder, IconChevronDown } from '@/components/icons'

export function ActiveProjectBar() {
  const { profile } = useAuth()
  const isPro = profile?.plan === 'pro'
  const { projects } = useProjects({ isPro, enabled: isPro })
  const { activeProjectId, setActiveProjectId } = useActiveProject()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-reset si el proyecto activo dejó de existir o se archivó.
  // useProjects ya devuelve solo activos.
  useEffect(() => {
    if (!isPro || !activeProjectId) return
    if (projects.length === 0) return // todavía no cargó
    const exists = projects.some(p => p.id === activeProjectId)
    if (!exists) setActiveProjectId(null)
  }, [isPro, activeProjectId, projects, setActiveProjectId])

  // Cerrar al click fuera.
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!isPro) return null

  // Si el user todavía no tiene proyectos creados, no mostramos la barra.
  // Tendría solo "General" y no agrega valor.
  if (projects.length === 0) return null

  const activeProject = activeProjectId
    ? projects.find(p => p.id === activeProjectId) ?? null
    : null

  const label = activeProject ? activeProject.name : 'General'

  return (
    <div className="relative max-w-[140px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={[
          'inline-flex items-center gap-1 py-1 px-2.5 rounded-full border text-xs font-bold transition-colors max-w-full',
          activeProject
            ? 'bg-brand text-white border-brand'
            : 'bg-brand-chip text-brand border-brand-border',
        ].join(' ')}
        aria-expanded={open}
        aria-label={`Proyecto activo: ${label}`}
      >
        <span className="truncate min-w-0">
          {label}
        </span>
        <IconChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-brand-border rounded-lg shadow-md z-30 max-h-[60vh] overflow-y-auto min-w-[240px]">
          <button
            type="button"
            onClick={() => {
              setActiveProjectId(null)
              setOpen(false)
            }}
            className={[
              'w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 border-b border-brand-border/50',
              !activeProjectId ? 'bg-brand-chip font-bold text-brand' : 'text-brand',
            ].join(' ')}
          >
            <IconFolder size={14} />
            <span className="flex-1">General</span>
            <span className="text-[10px] text-brand-mid">todos los movimientos</span>
          </button>

          {projects.map(p => {
            const isActive = p.id === activeProjectId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProjectId(p.id)
                  setOpen(false)
                }}
                className={[
                  'w-full text-left px-4 py-3 text-sm transition-colors flex items-start gap-2 border-b border-brand-border/30 last:border-b-0',
                  isActive ? 'bg-brand-chip font-bold text-brand' : 'text-brand',
                ].join(' ')}
              >
                <IconFolder size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{p.name}</p>
                  {p.clientName && (
                    <p className="text-[11px] text-brand-mid font-normal truncate">
                      {p.clientName}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
