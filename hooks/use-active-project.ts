'use client'

/**
 * useActiveProject (v0.61) — selector global de proyecto activo para Pro users.
 *
 * Estado client-side persistido en localStorage por device (no DB). Cuando el
 * Pro selecciona un proyecto en la barrita del header:
 *  - `/inicio` filtra cards de métricas + lista de movs recientes a ese proyecto.
 *  - Cualquier captura nueva (texto/voz/foto) pre-asigna `projectId` al nuevo mov.
 *  - El user puede cambiar en ConfirmationScreen — el selector es solo default.
 *
 * "General" = null (sin filtro, comportamiento clásico). Default al primer load.
 *
 * Auto-reset cuando el proyecto seleccionado se archiva/elimina (validado en
 * cada render: si el id ya no está en la lista de activos del user, fallback a null).
 *
 * Free no usa este hook — el header no renderea la barrita.
 *
 * Implementación: no necesita Context — useSyncExternalStore con localStorage
 * como source of truth. Múltiples componentes pueden suscribirse y
 * actualizaciones cross-tab funcionan vía 'storage' event.
 */

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'fiza.activeProjectId'

function getSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

function getServerSnapshot(): string | null {
  return null
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  function handler(e: StorageEvent) {
    if (e.key === STORAGE_KEY || e.key === null) callback()
  }
  window.addEventListener('storage', handler)
  // Custom event para cambios en la misma tab (storage event no se dispara en
  // la tab que escribió el cambio).
  window.addEventListener('fiza:active-project-changed', callback)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener('fiza:active-project-changed', callback)
  }
}

/**
 * Lee el activeProjectId directamente del localStorage SIN hook. Útil cuando
 * necesitas el valor desde un callback registrado con useEffect([]) (closure
 * stale) — ej. recorder.onResult de voz, donde el subscribe inicial captura
 * el state de la primera render y nunca ve actualizaciones.
 *
 * localStorage es síncrono y siempre actualizado, así que esto sirve como
 * "read-anytime" sin depender de re-renders.
 */
export function readActiveProjectId(): string | null {
  return getSnapshot()
}

export interface UseActiveProjectResult {
  /** ID del proyecto activo o null si "General". */
  activeProjectId: string | null
  /** Setter — pasa null para volver a "General". */
  setActiveProjectId: (id: string | null) => void
}

export function useActiveProject(): UseActiveProjectResult {
  const activeProjectId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setActiveProjectId = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
      // Custom event para que otros componentes en la misma tab se enteren.
      window.dispatchEvent(new Event('fiza:active-project-changed'))
    } catch {}
  }, [])

  return { activeProjectId, setActiveProjectId }
}
