'use client'

import { useState } from 'react'
import type { EntradaDia } from '@/lib/types'
import { guardarEntrada, getFechaHoy } from '@/lib/storage'

interface EntradaFormProps {
  onNuevaEntrada: (entrada: EntradaDia) => void
}

export default function EntradaForm({ onNuevaEntrada }: EntradaFormProps) {
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setCargando(true)
    setError('')

    try {
      const res = await fetch('/api/procesar-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Error al procesar. Intenta de nuevo.')
        return
      }

      const fecha = getFechaHoy()
      const nuevaEntrada: EntradaDia = {
        id: Date.now().toString(),
        textoOriginal: texto,
        items: data.items,
        fecha,
        creadoEn: Date.now(),
      }

      guardarEntrada(nuevaEntrada)
      onNuevaEntrada(nuevaEntrada)
      setTexto('')
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-700 mb-3">¿Qué pasó hoy en tu negocio?</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: vendí 1,500 en tacos, gasté 300 en tortillas y 120 en gas. Mañana debo pagar 400 de renta."
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 placeholder-gray-400"
          disabled={cargando}
        />
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="bg-blue-600 text-white rounded-lg py-2.5 px-4 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {cargando ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Procesando con IA...
            </>
          ) : (
            'Registrar'
          )}
        </button>
      </form>
    </div>
  )
}
