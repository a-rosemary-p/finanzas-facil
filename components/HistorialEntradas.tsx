import type { EntradaDia } from '@/lib/types'
import { formatPesos } from '@/lib/storage'

interface HistorialEntradasProps {
  entradas: EntradaDia[]
}

export default function HistorialEntradas({ entradas }: HistorialEntradasProps) {
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
          <p className="text-sm italic text-gray-400">"{entrada.textoOriginal}"</p>
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
