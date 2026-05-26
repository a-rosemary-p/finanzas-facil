'use client'

/**
 * Menú "..." en el header de /proyectos/[id]. Acciones:
 *   - Editar nombre/cliente/notas (abre modal — manejado por el padre)
 *   - Archivar (con dialog de confirmación que avisa qué pasa con pendientes
 *     y recurrentes)
 *   - Reabrir (si está archivado)
 *   - Eliminar (doble click — primero "¿Seguro?", segundo ejecuta)
 *
 * Después de archivar/reabrir/eliminar dispara el callback correspondiente
 * para que el padre haga refetch o redirect.
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import { useToast } from '@/components/ui/toast'
import type { Project } from '@/types'

interface ProjectActionsMenuProps {
  project: Project
  onEdit: () => void
  onArchived: () => void
  onReopened: () => void
  onDeleted: () => void
}

export function ProjectActionsMenu({
  project, onEdit, onArchived, onReopened, onDeleted,
}: ProjectActionsMenuProps) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isArchived = project.status === 'archived'

  async function handleArchive() {
    setBusy(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/projects/${project.id}/archive`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        pendingMovementsAffected?: number
        pausedRecurringCount?: number
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo archivar')
        setBusy(false)
        return
      }
      setOpen(false)
      setConfirmArchive(false)
      onArchived()
    } catch {
      setError('No se pudo conectar')
    } finally {
      setBusy(false)
    }
  }

  async function handleReopen() {
    setBusy(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/projects/${project.id}/reopen`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        code?: string
        pausedRecurringCount?: number
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo reabrir')
        setBusy(false)
        return
      }
      // Aviso si hay recurrentes pausados que NO se reactivan automáticamente.
      // El user debe ir a /pendientes a reactivarlos. v0.63: ahora usamos
      // toast del design system en lugar de window.alert nativo.
      if ((data.pausedRecurringCount ?? 0) > 0) {
        const n = data.pausedRecurringCount as number
        toast.show({
          kind: 'warning',
          duration: 8000,
          message: `Proyecto reabierto. ${n} recurrente${n !== 1 ? 's' : ''} sigue${n !== 1 ? 'n' : ''} pausado${n !== 1 ? 's' : ''} — actívalos desde Pendientes si quieres.`,
        })
      } else {
        toast.show({ kind: 'success', message: 'Proyecto reabierto.' })
      }
      setOpen(false)
      onReopened()
    } catch {
      setError('No se pudo conectar')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/projects/${project.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as {
        orphanedMovements?: number
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar')
        return
      }
      onDeleted()
    } catch {
      setError('No se pudo conectar')
    } finally {
      // v0.63: siempre limpiar busy. Antes solo se limpiaba en error path —
      // si onDeleted() fallaba al navegar, el botón quedaba spinning.
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded-md text-brand-mid text-lg font-bold"
        aria-label="Acciones"
      >
        ⋯
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar tap-outside */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setOpen(false)
              setConfirmArchive(false)
              setConfirmDelete(false)
            }}
          />
          <div className="absolute right-4 mt-9 bg-white border border-brand-border rounded-lg shadow-md flex flex-col z-40 min-w-[180px]">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
              className="text-left text-sm px-3 py-2 text-brand"
            >
              Editar
            </button>

            {!isArchived ? (
              !confirmArchive ? (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="text-left text-sm px-3 py-2 text-brand"
                >
                  Archivar
                </button>
              ) : (
                <div className="flex flex-col gap-1 px-3 py-2 bg-brand-chip">
                  <p className="text-[11px] text-brand-mid leading-snug">
                    Pendientes siguen activos. Recurrentes asociados se pausan.
                  </p>
                  <div className="flex gap-1.5 mt-1">
                    <button
                      disabled={busy}
                      onClick={handleArchive}
                      className="flex-1 text-xs font-bold rounded py-1 bg-brand text-white"
                    >
                      Sí, archivar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirmArchive(false)}
                      className="flex-1 text-xs font-medium rounded py-1 bg-white border border-brand-border text-brand-mid"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleReopen}
                className="text-left text-sm px-3 py-2 text-brand"
              >
                Reabrir
              </button>
            )}

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-left text-sm px-3 py-2 text-danger border-t border-brand-border"
              >
                Eliminar
              </button>
            ) : (
              <div className="flex flex-col gap-1 px-3 py-2 bg-paper-2 border-t border-brand-border">
                <p className="text-[11px] text-brand-mid leading-snug">
                  Los movimientos quedarán sin proyecto. No se borran.
                </p>
                <div className="flex gap-1.5 mt-1">
                  <button
                    disabled={busy}
                    onClick={handleDelete}
                    className="flex-1 text-xs font-bold rounded py-1 bg-danger text-white"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 text-xs font-medium rounded py-1 bg-white border border-brand-border text-brand-mid"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-danger px-3 py-1.5">{error}</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
