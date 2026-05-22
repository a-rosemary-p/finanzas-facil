'use client'

/**
 * Modal para editar name, clientName, notes de un proyecto. PATCH /api/projects/[id].
 */

import { useState } from 'react'
import { fetchWithAuthRetry } from '@/lib/fetch-with-auth'
import type { Project } from '@/types'

interface EditProjectModalProps {
  project: Project
  onClose: () => void
  onSaved: () => void
}

export function EditProjectModal({ project, onClose, onSaved }: EditProjectModalProps) {
  const [name, setName] = useState(project.name)
  const [clientName, setClientName] = useState(project.clientName ?? '')
  const [notes, setNotes] = useState(project.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (name.trim().length === 0) {
      setError('El nombre es requerido')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetchWithAuthRetry(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar')
        setBusy(false)
        return
      }
      onSaved()
    } catch {
      setError('No se pudo conectar')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-base text-brand">Editar proyecto</h2>

        <div className="flex flex-col gap-1">
          <label className="fz-input-label">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="fz-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="fz-input-label">Cliente / proveedor</label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            maxLength={60}
            className="fz-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="fz-input-label">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={2000}
            rows={4}
            className="fz-input resize-y"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 mt-1">
          <button
            disabled={busy || name.trim().length === 0}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            disabled={busy}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-brand-mid bg-paper-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
