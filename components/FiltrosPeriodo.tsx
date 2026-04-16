'use client'

import type { Filtro } from '@/lib/storage'
import { LABEL_FILTRO } from '@/lib/storage'

interface FiltrosPeriodoProps {
  filtroActivo: Filtro
  onChange: (filtro: Filtro) => void
}

const FILTROS: Filtro[] = ['hoy', '7dias', 'mes', 'anio']

export default function FiltrosPeriodo({ filtroActivo, onChange }: FiltrosPeriodoProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FILTROS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors border min-h-[44px] flex items-center ${
            filtroActivo === f
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-500'
          }`}
        >
          {LABEL_FILTRO[f]}
        </button>
      ))}
    </div>
  )
}
