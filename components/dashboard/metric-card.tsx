import { formatCurrency } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: number
  color: string
  bg: string
  border: string
  sign: string
}

export function MetricCard({ label, value, color, bg, border, sign }: MetricCardProps) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 min-w-0" style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color }}>{label}</span>
      <span className="text-base font-bold truncate leading-tight" style={{ color }}>
        {sign}{formatCurrency(value)}
      </span>
    </div>
  )
}
