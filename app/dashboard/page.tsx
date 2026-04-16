'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MetricCard from '@/components/MetricCard'
import EntradaForm from '@/components/EntradaForm'
import HistorialEntradas from '@/components/HistorialEntradas'
import FiltrosPeriodo from '@/components/FiltrosPeriodo'
import {
  getFechaHoy,
  cargarEntradasRango,
  calcularResumenDia,
  getRangoFiltro,
  LABEL_FILTRO,
  type Filtro,
} from '@/lib/storage'
import type { EntradaDia, ResumenDia } from '@/lib/types'

function getFechaFormateada(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('hoy')
  const [entradas, setEntradas] = useState<EntradaDia[]>([])
  const [resumen, setResumen] = useState<ResumenDia>({ ingresos: 0, gastos: 0, pendientes: 0 })
  const [errorStorage, setErrorStorage] = useState(false)

  const cargarEntradas = useCallback((f: Filtro) => {
    try {
      const { inicio, fin } = getRangoFiltro(f)
      // Siempre filtra por fechaMovimiento (cuando ocurrió), no por fecha de registro
      const data = cargarEntradasRango(inicio, fin)
      setEntradas(data)
      setResumen(calcularResumenDia(data))
    } catch {
      setErrorStorage(true)
    }
  }, [])

  useEffect(() => {
    try {
      const session = localStorage.getItem('session')
      if (!session) { router.replace('/'); return }
      const { loggedIn, email: e } = JSON.parse(session)
      if (!loggedIn) { router.replace('/'); return }
      setEmail(e)
      cargarEntradas('hoy')
    } catch {
      setErrorStorage(true)
    }
  }, [router, cargarEntradas])

  function handleResetStorage() {
    // Borra entradas pero conserva la sesión
    const session = localStorage.getItem('session')
    localStorage.clear()
    if (session) localStorage.setItem('session', session)
    setErrorStorage(false)
    setEntradas([])
    setResumen({ ingresos: 0, gastos: 0, pendientes: 0 })
  }

  function handleFiltroChange(f: Filtro) {
    setFiltro(f)
    cargarEntradas(f)
  }

  function handleNuevaEntrada(nueva: EntradaDia) {
    const { inicio, fin } = getRangoFiltro(filtro)
    const fm = nueva.fechaMovimiento ?? nueva.fecha
    if (fm >= inicio && fm <= fin) {
      const actualizadas = [nueva, ...entradas]
      setEntradas(actualizadas)
      setResumen(calcularResumenDia(actualizadas))
    }
  }

  function handleEntradaActualizada(actualizada: EntradaDia) {
    const actualizadas = entradas.map((e) => (e.id === actualizada.id ? actualizada : e))
    setEntradas(actualizadas)
    setResumen(calcularResumenDia(actualizadas))
  }

  function handleLogout() {
    localStorage.removeItem('session')
    router.replace('/')
  }

  const neto = resumen.ingresos - resumen.gastos
  const tituloHistorial = filtro === 'hoy' ? 'Registros de hoy' : `Registros — ${LABEL_FILTRO[filtro]}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-10 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <span className="font-bold text-gray-800 text-lg">💰 FinanzasFácil</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
        >
          Cerrar sesión
        </button>
      </header>

      <main
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Saludo */}
        <div>
          <p className="text-gray-800 font-medium">Hola, {email}</p>
          <p className="text-gray-400 text-sm capitalize">{getFechaFormateada()}</p>
        </div>

        {/* Banner de error de datos */}
        {errorStorage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-sm font-medium text-red-700">⚠️ Hubo un problema al leer tus datos guardados.</p>
            <p className="text-xs text-red-500">Puedes limpiar los datos locales para continuar — tus entradas anteriores se perderán.</p>
            <button
              onClick={handleResetStorage}
              className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg py-2 px-3 w-fit transition-colors"
            >
              Limpiar datos y continuar
            </button>
          </div>
        )}

        {/* Filtros */}
        <FiltrosPeriodo filtroActivo={filtro} onChange={handleFiltroChange} />

        {/* Métricas — se recalculan con el filtro */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Ingresos" valor={resumen.ingresos} tipo="ingreso" />
          <MetricCard label="Gastos" valor={resumen.gastos} tipo="gasto" />
          <MetricCard label="Neto" valor={neto} tipo="neto" />
        </div>

        {/* Formulario (siempre registra en fecha de hoy) */}
        <EntradaForm onNuevaEntrada={handleNuevaEntrada} />

        {/* Historial filtrado */}
        <HistorialEntradas
          entradas={entradas}
          onEntradaActualizada={handleEntradaActualizada}
          titulo={tituloHistorial}
        />
      </main>
    </div>
  )
}
