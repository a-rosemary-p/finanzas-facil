'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MetricCard from '@/components/MetricCard'
import EntradaForm from '@/components/EntradaForm'
import HistorialEntradas from '@/components/HistorialEntradas'
import FiltrosPeriodo from '@/components/FiltrosPeriodo'
import {
  getFechaHoy,
  cargarEntradasDia,
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

  const cargarEntradas = useCallback((f: Filtro) => {
    const { inicio, fin } = getRangoFiltro(f)
    const data = f === 'hoy'
      ? cargarEntradasDia(getFechaHoy())
      : cargarEntradasRango(inicio, fin)
    setEntradas(data)
    setResumen(calcularResumenDia(data))
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('session')
    if (!session) { router.replace('/'); return }
    const { loggedIn, email: e } = JSON.parse(session)
    if (!loggedIn) { router.replace('/'); return }
    setEmail(e)
    cargarEntradas('hoy')
  }, [router, cargarEntradas])

  function handleFiltroChange(f: Filtro) {
    setFiltro(f)
    cargarEntradas(f)
  }

  function handleNuevaEntrada(nueva: EntradaDia) {
    // Solo agregar al estado si la fecha de la entrada cae dentro del filtro activo
    const { inicio, fin } = getRangoFiltro(filtro)
    if (nueva.fecha >= inicio && nueva.fecha <= fin) {
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
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-bold text-gray-800 text-lg">💰 FinanzasFácil</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Saludo */}
        <div>
          <p className="text-gray-800 font-medium">Hola, {email}</p>
          <p className="text-gray-400 text-sm capitalize">{getFechaFormateada()}</p>
        </div>

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
