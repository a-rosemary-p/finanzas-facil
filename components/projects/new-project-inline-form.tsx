'use client'

/**
 * Form inline para crear un proyecto desde /proyectos o desde el detail page.
 * Autocomplete de cliente vía /api/projects/clients?q=. Llama POST /api/projects
 * y devuelve el Project creado al padre via onCreated.
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { Project } from '@/types'

interface NewProjectInlineFormProps {
  onCancel: () => void
  onCreated: (project: Project) => void
}

export function NewProjectInlineForm({ onCancel, onCreated }: NewProjectInlineFormProps) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientSugs, setClientSugs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchClientSugs(q: string) {
    if (q.length === 0) return setClientSugs([])
    try {
      const res = await fetchWithAuthRetry(`/api/projects/clients?q=${encodeURIComponent(q)}`, { method: 'GET' })
      if (res.ok) {
        const data = (await res.json()) as { suggestions: string[] }
        setClientSugs(data.suggestions ?? [])
      }
    } catch {}
  }

  async function handleSubmit() {
    if (name.trim().length === 0) {
      setError('El nombre es requerido')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { project?: Project; error?: string; code?: string }
      if (!res.ok || !data.project) {
        setError(data.error ?? `Error (${res.status})`)
        setLoading(false)
        return
      }
      onCreated(data.project)
    } catch {
      setError('No se pudo conectar')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-brand-border flex flex-col gap-3">
      <p className="text-xs font-bold uppercase text-brand-mid">Nuevo proyecto</p>

      <div className="flex flex-col gap-1">
        <label className="fz-input-label">Nombre del proyecto</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          placeholder="Ej: Casa Pedro"
          className="fz-input"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1 relative">
        <label className="fz-input-label">Cliente / proveedor (opcional)</label>
        <input
          type="text"
          value={clientName}
          onChange={e => {
            setClientName(e.target.value)
            fetchClientSugs(e.target.value)
          }}
          maxLength={60}
          placeholder="Ej: Pedro Reyes"
          className="fz-input"
        />
        {clientSugs.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-brand-border rounded-md mt-1 z-10 max-h-40 overflow-y-auto shadow-sm">
            {clientSugs.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setClientName(s)
                  setClientSugs([])
                }}
                className="block w-full text-left text-sm px-3 py-2 text-brand"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || name.trim().length === 0}
          onClick={handleSubmit}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white disabled:opacity-50"
        >
          {loading ? 'Creando…' : 'Crear proyecto'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-brand-mid bg-paper-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
