'use client'

import { useState } from 'react'
import type { EntradaDia, ItemMovimiento, TipoMovimiento } from '@/lib/types'
import { formatPesos, getFechaHoy, actualizarEntrada } from '@/lib/storage'

interface HistorialEntradasProps {
  entradas: EntradaDia[]
  onEntradaActualizada: (entrada: EntradaDia) => void
}

const CATEGORIAS = ['Ventas', 'Ingredientes', 'Servicios', 'Transporte', 'Renta', 'Servicios básicos', 'Otro']
const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: 'ingreso', label: '+ Ingreso' },
  { value: 'gasto', label: '- Gasto' },
  { value: 'pendiente', label: '⏳ Pendiente' },
]

function formatFechaCorta(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function EntradaCard({
  entrada,
  onActualizar,
}: {
  entrada: EntradaDia
  onActualizar: (e: EntradaDia) => void
}) {
  const hoy = getFechaHoy()
  const fmov = entrada.fechaMovimiento ?? entrada.fecha
  const [editando, setEditando] = useState(false)

  // Estado editable
  const [draftFecha, setDraftFecha] = useState(fmov)
  const [draftTexto, setDraftTexto] = useState(entrada.textoOriginal)
  const [draftItems, setDraftItems] = useState<ItemMovimiento[]>(entrada.items)

  function abrirEdicion() {
    setDraftFecha(fmov)
    setDraftTexto(entrada.textoOriginal)
    setDraftItems(entrada.items.map((i) => ({ ...i })))
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
  }

  function guardar() {
    const actualizada: EntradaDia = {
      ...entrada,
      textoOriginal: draftTexto,
      fechaMovimiento: draftFecha,
      items: draftItems,
    }
    actualizarEntrada(actualizada)
    onActualizar(actualizada)
    setEditando(false)
  }

  function actualizarItem(idx: number, campo: keyof ItemMovimiento, valor: string | number) {
    setDraftItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item))
    )
  }

  function eliminarItem(idx: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function agregarItem() {
    setDraftItems((prev) => [
      ...prev,
      { tipo: 'ingreso', descripcion: '', categoria: 'Ventas', monto: 0 },
    ])
  }

  const labelRegistro = entrada.fecha === hoy ? 'Registrado hoy' : `Registrado el ${formatFechaCorta(entrada.fecha)}`
  const fechasDistintas = fmov !== entrada.fecha

  // ── MODO LECTURA ──
  if (!editando) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 relative">
        {/* Botón editar — esquina superior derecha */}
        <button
          onClick={abrirEdicion}
          title="Editar entrada"
          className="absolute top-3 right-3 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors bg-gray-50 hover:bg-blue-50 rounded-lg px-2 py-1 border border-gray-200 hover:border-blue-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Editar
        </button>

        <div className="flex flex-col gap-0.5 pr-16">
          <p className="text-sm italic text-gray-400">"{entrada.textoOriginal}"</p>
          <span className="text-xs text-gray-400">
            {labelRegistro}
            {fechasDistintas && (
              <> · <span className="text-amber-600">Ocurrió el {formatFechaCorta(fmov)}</span></>
            )}
          </span>
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
              <span className={`text-sm font-semibold whitespace-nowrap ${
                item.tipo === 'ingreso' ? 'text-green-600' : item.tipo === 'gasto' ? 'text-red-500' : 'text-amber-600'
              }`}>
                {item.tipo === 'ingreso' ? '+' : item.tipo === 'gasto' ? '-' : ''}
                {formatPesos(item.monto)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── MODO EDICIÓN ──
  return (
    <div className="bg-white border-2 border-blue-300 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-600">Editando entrada</span>
        <span className="text-xs text-gray-400">{labelRegistro}</span>
      </div>

      {/* Texto original */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Texto original</label>
        <textarea
          value={draftTexto}
          onChange={(e) => setDraftTexto(e.target.value)}
          rows={2}
          className="border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
        />
      </div>

      {/* Fecha del movimiento */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">¿Cuándo ocurrió?</label>
        <input
          type="date"
          value={draftFecha}
          max={hoy}
          onChange={(e) => setDraftFecha(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
        />
      </div>

      {/* Movimientos */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-500">Movimientos</label>
        {draftItems.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1.5 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex gap-2">
              {/* Tipo */}
              <select
                value={item.tipo}
                onChange={(e) => actualizarItem(idx, 'tipo', e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 bg-white"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {/* Monto */}
              <input
                type="number"
                value={item.monto}
                min={0}
                onChange={(e) => actualizarItem(idx, 'monto', Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 w-24"
                placeholder="Monto"
              />
              {/* Botón eliminar */}
              <button
                onClick={() => eliminarItem(idx)}
                className="ml-auto text-gray-300 hover:text-red-400 transition-colors"
                title="Eliminar movimiento"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {/* Descripción */}
            <input
              type="text"
              value={item.descripcion}
              onChange={(e) => actualizarItem(idx, 'descripcion', e.target.value)}
              placeholder="Descripción"
              className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700"
            />
            {/* Categoría */}
            <select
              value={item.categoria}
              onChange={(e) => actualizarItem(idx, 'categoria', e.target.value)}
              className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 bg-white"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ))}

        <button
          onClick={agregarItem}
          className="text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 rounded-lg py-2 hover:bg-blue-50 transition-colors"
        >
          + Agregar movimiento
        </button>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={guardar}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Guardar
        </button>
        <button
          onClick={cancelar}
          className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
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
        <EntradaCard key={entrada.id} entrada={entrada} onActualizar={onEntradaActualizada} />
      ))}
    </div>
  )
}
