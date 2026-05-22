'use client'

/**
 * Selector de proyecto para ConfirmationScreen / formularios de pendientes y
 * recurrentes. v0.5.
 *
 * Modos:
 *   - Pro: dropdown nativo con (a) "Sin proyecto", (b) opción "+ Crear <X>" si
 *     `pendingCreateName` viene de la IA, (c) lista de proyectos activos,
 *     (d) "+ Nuevo proyecto…" que abre un mini-form inline.
 *     Si la IA sugirió con confidence='low', mostramos un hint "Sugerido por IA".
 *
 *   - Free: campo deshabilitado con candado. Click → track('projects_teaser_clicked')
 *     + startProCheckout().
 *
 * Estado del mini-form lo maneja el padre cuando es ConfirmationScreen (porque
 * el patrón es per-movimiento). Para simplificar, el selector emite eventos
 * (onCreateRequest) y deja que el padre renderee el form si quiere — pero
 * 90% de los callers solo necesitan el dropdown así que devolvemos un
 * componente "todo en uno" con el form ya integrado.
 */

import { useState } from 'react'
import { IconLock, IconFolder } from '@/components/icons'
import { startProCheckout } from '@/lib/upgrade-to-pro'
import { track } from '@/lib/analytics'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { Project, ProjectSuggestion, ProjectWithSummary } from '@/types'

interface ProjectSelectorProps {
  /** Lista de proyectos activos para mostrar en el dropdown. */
  projects: ProjectWithSummary[] | Project[]
  /** ID del proyecto actualmente asignado (null = sin proyecto). */
  value: string | null
  /** Si vino del payload de IA: nombre a crear pre-rellenado. */
  pendingCreateName?: string | null
  /** Metadata de sugerencia IA para hint visual. */
  suggestion?: ProjectSuggestion | null
  /** Se llama cuando el user selecciona un proyecto existente o "Sin proyecto". */
  onChange: (projectId: string | null) => void
  /** Se llama cuando el user pidió crear un proyecto nuevo y lo confirmó
   * (el padre debe persistir y devolverlo). Recibe el name + clientName?. */
  onCreate?: (name: string, clientName: string | null) => Promise<Project | null>
  /** Plan del user. Si 'free' renderiza teaser. */
  isPro: boolean
  /** Origen del teaser (para analytics). */
  teaserSource?: 'confirmation' | 'pendientes' | 'recurrentes' | 'movimientos'
  /** Auto-elegir el proyecto recién creado al pedirlo. Default true. */
  autoSelectOnCreate?: boolean
}

const OPEN_CREATE = '__open_create__'
const CREATE_FROM_AI = '__create_from_ai__'
const NO_PROJECT = '__none__'

export function ProjectSelector({
  projects,
  value,
  pendingCreateName,
  suggestion,
  onChange,
  onCreate,
  isPro,
  teaserSource = 'confirmation',
  autoSelectOnCreate = true,
}: ProjectSelectorProps) {
  const [showInlineForm, setShowInlineForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formClient, setFormClient] = useState('')
  const [formError, setFormError] = useState('')
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([])

  // ── Teaser para Free ────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="flex flex-col gap-1">
        <label className="fz-input-label">Proyecto</label>
        <button
          type="button"
          onClick={() => {
            track('projects_teaser_clicked', { source: teaserSource })
            startProCheckout()
          }}
          className="fz-input flex items-center gap-2 text-left text-brand-muted bg-paper-2 cursor-pointer"
        >
          <IconLock />
          <span className="flex-1 text-sm">Asignar a proyecto — disponible en Pro</span>
        </button>
      </div>
    )
  }

  // ── Selector Pro ────────────────────────────────────────────────────────

  async function fetchClientSuggestions(q: string) {
    if (q.length === 0) return setClientSuggestions([])
    try {
      const res = await fetchWithAuthRetry(`/api/projects/clients?q=${encodeURIComponent(q)}`, { method: 'GET' })
      if (res.ok) {
        const data = (await res.json()) as { suggestions: string[] }
        setClientSuggestions(data.suggestions ?? [])
      }
    } catch {
      // Silent fail — autocomplete es opcional.
    }
  }

  async function handleCreate(name: string, clientName: string | null) {
    if (!onCreate) return
    setCreating(true)
    setFormError('')
    try {
      const proj = await onCreate(name, clientName)
      if (proj) {
        if (autoSelectOnCreate) onChange(proj.id)
        setShowInlineForm(false)
        setFormName('')
        setFormClient('')
        setClientSuggestions([])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear'
      setFormError(msg)
      // Cuando el create vino del "+ Crear <X>" de IA (no del mini-form),
      // showInlineForm=false; abrimos el form para que el user vea el error
      // y pueda decidir (cancelar o intentar otro nombre / archivar).
      if (!showInlineForm) {
        setFormName(name)
        setFormClient(clientName ?? '')
        setShowInlineForm(true)
      }
    } finally {
      setCreating(false)
    }
  }

  function handleDropdownChange(val: string) {
    if (val === NO_PROJECT) {
      onChange(null)
      return
    }
    if (val === OPEN_CREATE) {
      setFormName('')
      setFormClient('')
      setShowInlineForm(true)
      return
    }
    if (val === CREATE_FROM_AI && pendingCreateName) {
      // One-click: crear con el nombre que sugirió la IA.
      handleCreate(pendingCreateName, null)
      return
    }
    onChange(val)
  }

  const isLowConfidenceSuggestion =
    suggestion?.confidence === 'low' && !value && !pendingCreateName

  return (
    <div className="flex flex-col gap-1">
      <label className="fz-input-label flex items-center gap-1.5">
        <IconFolder size={14} />
        Proyecto
      </label>

      {isLowConfidenceSuggestion && (
        <p className="text-[11px] text-brand-mid bg-brand-chip rounded-md px-2 py-1.5 leading-snug">
          La IA detectó posibles proyectos pero no estaba segura. Elígelo abajo si aplica.
        </p>
      )}

      <select
        value={value ?? NO_PROJECT}
        onChange={e => handleDropdownChange(e.target.value)}
        className="fz-input"
      >
        <option value={NO_PROJECT}>Sin proyecto</option>
        {pendingCreateName && (
          <option value={CREATE_FROM_AI}>
            + Crear &ldquo;{pendingCreateName}&rdquo;
          </option>
        )}
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.clientName ? ` · ${p.clientName}` : ''}
          </option>
        ))}
        <option value={OPEN_CREATE}>+ Nuevo proyecto…</option>
      </select>

      {/* Mini-form inline para crear */}
      {showInlineForm && (
        <div className="bg-brand-chip border border-brand-border rounded-lg p-3 flex flex-col gap-2 mt-1">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-brand-mid">Nombre del proyecto</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              maxLength={60}
              placeholder="Ej: Casa Pedro"
              className="fz-input text-sm"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1 relative">
            <label className="text-[11px] font-medium text-brand-mid">Cliente / proveedor (opcional)</label>
            <input
              type="text"
              value={formClient}
              onChange={e => {
                setFormClient(e.target.value)
                fetchClientSuggestions(e.target.value)
              }}
              maxLength={60}
              placeholder="Ej: Pedro Reyes"
              className="fz-input text-sm"
            />
            {clientSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-brand-border rounded-md mt-1 z-10 max-h-32 overflow-y-auto">
                {clientSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setFormClient(s)
                      setClientSuggestions([])
                    }}
                    className="block w-full text-left text-sm px-2 py-1.5 text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {formError && <p className="text-xs text-danger">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating || formName.trim().length === 0}
              onClick={() => handleCreate(formName.trim(), formClient.trim() || null)}
              className="flex-1 py-1.5 rounded-md text-xs font-bold bg-brand text-white disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear y asignar'}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setShowInlineForm(false)
                setFormError('')
              }}
              className="flex-1 py-1.5 rounded-md text-xs font-medium text-brand-mid bg-white border border-brand-border"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
