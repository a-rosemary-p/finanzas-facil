'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MetricCard from '@/components/MetricCard'
import EntradaForm from '@/components/EntradaForm'
import HistorialEntradas from '@/components/HistorialEntradas'
import {
  getFechaHoy,
  cargarEntradasDia,
  calcularResumenDia,
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
  const [entradas, setEntradas] = useState<EntradaDia[]>([])
  const [resumen, setResumen] = useState<ResumenDia>({ ingresos: 0, gastos: 0, pendientes: 0 })

  useEffect(() => {
    const session = localStorage.getItem('session')
    if (!session) {
      router.replace('/')
      return
    }
    const { loggedIn, email: e } = JSON.parse(session)
    if (!loggedIn) {
      router.replace('/')
      return
    }
    setEmail(e)
    const hoy = getFechaHoy()
    const entradasHoy = cargarEntradasDia(hoy)
    setEntradas(entradasHoy)
    setResumen(calcularResumenDia(entradasHoy))
  }, [router])

  function handleNuevaEntrada(nueva: EntradaDia) {
    const actualizadas = [nueva, ...entradas]
    setEntradas(actualizadas)
    setResumen(calcularResumenDia(actualizadas))
  }

  function handleLogout() {
    localStorage.removeItem('session')
    router.replace('/')
  }

  const neto = resumen.ingresos - resumen.gastos

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

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Ingresos" valor={resumen.ingresos} tipo="ingreso" />
          <MetricCard label="Gastos" valor={resumen.gastos} tipo="gasto" />
          <MetricCard label="Neto" valor={neto} tipo="neto" />
        </div>

        {/* Formulario */}
        <EntradaForm onNuevaEntrada={handleNuevaEntrada} />

        {/* Historial */}
        <HistorialEntradas entradas={entradas} />
      </main>
    </div>
  )
}
