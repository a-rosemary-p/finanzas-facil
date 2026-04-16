'use client'

import { useState } from 'react'
import type { EntradaDia } from '@/lib/types'
import { formatPesos, getFechaHoy, actualizarEntrada } from '@/lib/storage'

interface HistorialEntradasProps {
  entradas: EntradaDia[]
  onEntradaActualizada: (entrada: EntradaDia) => void
}

function formatFechaCorta(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function EtiquetaFechas({
  entrada,
  onActualizar,
}: {
  entrada: EntradaDia
  onActualizar: (nueva: EntradaDia) => void
}) {
  const hoy = getFechaHoy()
  const fmov = entrada.fechaMovimiento ?? entrada.fecha
  const [editando, setEditando] = useState(false)

  function handleCambioFecha(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevaFecha = e.target.value
    if (!nuevaFecha) return
    const actualizada = { ...entrada, fechaMovimiento: nuevaFecha }
    actualizarEntrada(actualizada)
    onActualizar(actualizada)
    setEditando(false)
  }

  const labelRegistro =
    entrada.fecha === hoy ? 'Registrado hoy' : `Registrado el ${formatFechaCorta(entrada.fecha)}`

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-gray-400">{labelRegistro}</span>

      {fmov !== entrada.fecha && !editando && (
        <span className="text-xs text-gray-400">
          · <span className="text-amber-600">Ocurrió el {formatFechaCorta(fmov)}</span>
        </span>
      )}

      {editando ? (
        <input
          type="date"
          defaultValue={fmov}
          max={hoy}
          autoFocus
          onBlur={() => setEditando(false)}
          onChange={handleCambioFecha}
          className="text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
        />
      ) : (
        <button
          onClick={() => setEditando(true)}
          title="Editar fecha del movimiento"
          className="text-gray-300 hover:text-blue-400 transition-colors ml-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function HistorialEntradas({ entradas, onEntradaActualizada }: HistorialEntradasProps) {
  if (entradas.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        Aún no hay registros hoy. Escribe lo que pasó en tu negocio arriba.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-gray-700">Registros de hoy</h2>
      {entradas.map((entrada) => (
        <div key={entrada.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm italic text-gray-400">"{entrada.textoOriginal}"</p>
            <EtiquetaFechas entrada={entrada} onActualizar={onEntradaActualizada} />
          </div>
          <div className="flex flex-col gap-2">
            {entrada.items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  {item.tipo === 'pendiente' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit">
                      ⏳ Pendiente: {item.descripcion}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-700">{item.descripcion}</span>
                  )}
                  <span className="text-xs text-gray-400">{item.categoria}</span>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    item.tipo === 'ingreso'
                      ? 'text-green-600'
                      : item.tipo === 'gasto'
                      ? 'text-red-500'
                      : 'text-amber-600'
                  }`}
                >
                  {item.tipo === 'ingreso' ? '+' : item.tipo === 'gasto' ? '-' : ''}
                  {formatPesos(item.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
