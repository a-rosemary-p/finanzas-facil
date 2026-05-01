'use client'

/**
 * /pendientes — vista única (sin toggle), con tres secciones apiladas
 * en orden de urgencia descendente:
 *
 *   1. Recurrentes — siempre presente arriba. Si no hay, muestra mensaje
 *      vacío en lugar de ocultar la sección. Esto deja la jerarquía visual
 *      estable: el user entrenado sabe siempre que arriba están los templates.
 *   2. Vencidos    — solo si hay (movement_date < hoy CDMX).
 *   3. Pendientes  — los de hoy y futuros, ascending por fecha (hoy primero).
 *
 * Antes había tabs Pendientes/Recurrentes. Lo cambiamos porque obligaban
 * a clickear para ver dos cosas que el user quiere ver en paralelo: "qué
 * me toca pagar/cobrar" y "qué se me viene repitiendo automático".
 *
 * Cada sección lleva su propio header + WaveRule de cierre.
 */

import { AppHeader } from '@/components/app-header'
import { usePendings } from '@/hooks/use-pendings'
import { useRecurring } from '@/hooks/use-recurring'
import { PendingRow } from '@/components/pendientes/pending-row'
import { RecurringRow } from '@/components/pendientes/recurring-row'
import { WaveRule } from '@/components/ui/wave'

export default function PendientesPage() {
  const { overdue, upcoming, loading: pendingLoading, markAsPaid, updatePending, deletePending } = usePendings()
  const { recurring, loading: recurringLoading, update: updateRecurring, remove: removeRecurring } = useRecurring()

  const activeRecurring = recurring.filter(r => r.isActive)
  const pausedRecurring = recurring.filter(r => !r.isActive)

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      <AppHeader />

      <main
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--brand)' }}>Pendientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--brand-mid)' }}>
            Compromisos por pagar y movimientos que se repiten.
          </p>
        </div>

        {/* ── 1. Recurrentes (siempre visible) ─────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <SectionHeader title="Recurrentes" count={activeRecurring.length + pausedRecurring.length} />
          {recurringLoading ? (
            <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando recurrentes...</p>
          ) : recurring.length === 0 ? (
            <EmptyHint
              title="No hay recurrentes"
              body={<>Cuando registres algo y digas <i>&ldquo;cada mes&rdquo;</i> o <i>&ldquo;semanal&rdquo;</i>, Fiza lo detecta y aparece aquí.</>}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeRecurring.map(r => (
                <RecurringRow key={r.id} rec={r} onUpdate={updateRecurring} onDelete={removeRecurring} />
              ))}
              {pausedRecurring.length > 0 && (
                <>
                  <div
                    className="text-[10px] font-bold uppercase mt-2 mb-0.5 px-1"
                    style={{ letterSpacing: '0.08em', color: 'var(--brand-mid)' }}
                  >
                    Pausados
                  </div>
                  {pausedRecurring.map(r => (
                    <RecurringRow key={r.id} rec={r} onUpdate={updateRecurring} onDelete={removeRecurring} />
                  ))}
                </>
              )}
            </div>
          )}
          <WaveRule />
        </section>

        {/* ── 2. Vencidos (solo si hay) ────────────────────────────────── */}
        {!pendingLoading && overdue.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <SectionHeader title="Vencidos" count={overdue.length} tone="danger" />
            <div className="flex flex-col gap-1.5">
              {overdue.map(m => (
                <PendingRow
                  key={m.id}
                  mov={m}
                  overdue
                  onMarkAsPaid={markAsPaid}
                  onUpdate={updatePending}
                  onDelete={deletePending}
                />
              ))}
            </div>
            <WaveRule />
          </section>
        )}

        {/* ── 3. Pendientes (hoy y futuros) ────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <SectionHeader title="Pendientes" count={upcoming.length} />
          {pendingLoading ? (
            <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando pendientes...</p>
          ) : upcoming.length === 0 ? (
            <EmptyHint
              title="Sin pendientes"
              body={<>Cuando registres un compromiso por pagar (ej. <i>&ldquo;mañana pago la renta&rdquo;</i>), aparecerá aquí.</>}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {upcoming.map(m => (
                <PendingRow
                  key={m.id}
                  mov={m}
                  overdue={false}
                  onMarkAsPaid={markAsPaid}
                  onUpdate={updatePending}
                  onDelete={deletePending}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SectionHeader({
  title, count, tone = 'default',
}: {
  title: string
  count: number
  tone?: 'default' | 'danger'
}) {
  const color = tone === 'danger' ? 'var(--expense-text)' : 'var(--brand-mid)'
  return (
    <div className="flex items-center justify-between px-1">
      <h2
        className="text-xs font-bold uppercase"
        style={{ letterSpacing: '0.08em', color }}
      >
        {title}
      </h2>
      {count > 0 && (
        <span className="text-xs" style={{ color }}>
          {count}
        </span>
      )}
    </div>
  )
}

function EmptyHint({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-6 text-center"
      style={{
        background: 'rgba(255, 255, 255, 0.6)',
        border: '1px dashed var(--brand-border)',
        color: 'var(--brand-mid)',
      }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>{title}</p>
      <p className="text-xs mt-1.5 leading-relaxed" style={{ opacity: 0.9, maxWidth: 340, margin: '6px auto 0' }}>
        {body}
      </p>
    </div>
  )
}
