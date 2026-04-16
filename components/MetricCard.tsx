interface MetricCardProps {
  label: string
  valor: number
  tipo: 'ingreso' | 'gasto' | 'neto'
}

export default function MetricCard({ label, valor, tipo }: MetricCardProps) {
  let colorBg = 'bg-green-50'
  let colorText = 'text-green-600'
  let signo = ''

  if (tipo === 'gasto') {
    colorBg = 'bg-red-50'
    colorText = 'text-red-500'
  } else if (tipo === 'neto') {
    if (valor < 0) {
      colorBg = 'bg-red-50'
      colorText = 'text-red-500'
    } else {
      colorBg = 'bg-green-50'
      colorText = 'text-green-600'
    }
    signo = valor < 0 ? '' : '+'
  }

  const formatted = '$' + Math.abs(valor).toLocaleString('es-MX')

  return (
    <div className={`rounded-xl p-4 ${colorBg} flex flex-col gap-1`}>
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${colorText}`}>
        {signo}{formatted}
      </span>
    </div>
  )
}
