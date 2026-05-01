'use client'

/**
 * /pendientes — vista única (sin toggle), con tres secciones apiladas
 * en orden de urgencia descendente:
 *
 *   1. Recurrentes — siempre visible arriba, con empty-state si no hay.
 *   2. Vencidos    — solo si hay (movement_date < hoy CDMX).
 *   3. Pendientes  — los de hoy y futuros, ascending (hoy primero).
 *
 * Cada sección (Recurrentes y Pendientes) tiene un botón "+" en su header
 * que abre un formulario inline para crear el ítem manualmente.
 */

import { useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { usePendings } from '@/hooks/use-pendings'
import { useRecurring } from '@/hooks/use-recurring'
import { PendingRow } from '@/components/pendientes/pending-row'
import { RecurringRow } from '@/components/pendientes/recurring-row'
import { ManualPendingForm } from '@/components/pendientes/manual-pending-form'
import { ManualRecurringForm } from '@/components/pendientes/manual-recurring-form'
import { WaveSection } from '@/components/ui/wave'
import { IconPlus } from '@/components/icons'

export default function PendientesPage() {
  const {
    overdue, upcoming, loading: pendingLoading,
    markAsPaid, updatePending, deletePending, refresh: refreshPendings,
  } = usePendings()
  const {
    recurring, loading: recurringLoading,
    update: updateRecurring, remove: removeRecurring, refresh: refreshRecurring,
  } = useRecurring()

  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [showPendingForm,   setShowPendingForm]   = useState(false)

  const activeRecurring = recurring.filter(r => r.isActive)
  const pausedRecurring = recurring.filter(r => !r.isActive)

  return (
    <div className="min-h-screen fz-page-gradient">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6 fz-pad-safe-bottom">
        <div>
          <h1 className="font-bold text-lg text-brand">Pendientes</h1>
          <p className="text-sm mt-0.5 text-brand-mid">
            Compromisos por pagar y movimientos que se repiten.
          </p>
          <div className="mt-3">
            <WaveSection />
          </div>
        </div>

        {/* ── 1. Recurrentes (siempre visible) ─────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <SectionHeader
            title="Recurrentes"
            count={activeRecurring.length + pausedRecurring.length}
            onAdd={() => setShowRecurringForm(v => !v)}
            adding={showRecurringForm}
          />
          {showRecurringForm && (
            <ManualRecurringForm
              onClose={() => setShowRecurringForm(false)}
              onCreated={() => {
                void refreshRecurring()
                void refreshPendings()
              }}
            />
          )}
          {recurringLoading ? (
            <p className="text-sm text-brand-mid">Cargando recurrentes...</p>
          ) : recurring.length === 0 ? (
            <EmptyHint
              title="No hay recurrentes"
              body={<>Cuando registres algo y digas <i>&ldquo;cada mes&rdquo;</i> o <i>&ldquo;semanal&rdquo;</i>, Fiza lo detecta y aparece aquí. O agrégalo manual con el botón <strong>+</strong>.</>}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeRecurring.map(r => (
                <RecurringRow key={r.id} rec={r} onUpdate={updateRecurring} onDelete={removeRecurring} />
              ))}
              {pausedRecurring.length > 0 && (
                <>
                  <div className="fz-eyebrow mt-2 mb-0.5 px-1">Pausados</div>
                  {pausedRecurring.map(r => (
                    <RecurringRow key={r.id} rec={r} onUpdate={updateRecurring} onDelete={removeRecurring} />
                  ))}
                </>
              )}
            </div>
          )}
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
          </section>
        )}

        {/* ── 3. Pendientes (hoy y futuros) ────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <SectionHeader
            title="Pendientes"
            count={upcoming.length}
            onAdd={() => setShowPendingForm(v => !v)}
            adding={showPendingForm}
          />
          {showPendingForm && (
            <ManualPendingForm
              onClose={() => setShowPendingForm(false)}
              onCreated={() => { void refreshPendings() }}
            />
          )}
          {pendingLoading ? (
            <p className="text-sm text-brand-mid">Cargando pendientes...</p>
          ) : upcoming.length === 0 ? (
            <EmptyHint
              title="Sin pendientes"
              body={<>Cuando registres un compromiso por pagar (ej. <i>&ldquo;mañana pago la renta&rdquo;</i>), aparecerá aquí. O agrégalo manual con el botón <strong>+</strong>.</>}
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
  title, count, tone = 'default', onAdd, adding,
}: {
  title: string
  count: number
  tone?: 'default' | 'danger'
  onAdd?: () => void
  adding?: boolean
}) {
  const titleClass = tone === 'danger' ? 'text-expense-text' : 'text-brand-mid'
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <h2 className={`text-xs font-bold uppercase tracking-[0.08em] ${titleClass}`}>
          {title}
        </h2>
        {count > 0 && (
          <span className={`text-xs opacity-80 ${titleClass}`}>{count}</span>
        )}
      </div>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={adding ? `Cerrar formulario de ${title}` : `Agregar ${title}`}
          aria-expanded={adding}
          className={[
            'rounded-lg flex items-center justify-center transition-colors w-7 h-7 border border-brand-border',
            adding ? 'bg-brand text-white rotate-45' : 'bg-transparent text-brand-mid rotate-0',
          ].join(' ')}
          style={{
            // El rotate al cerrar/abrir necesita la transition combinada;
            // expresarla como un solo "transition-all" haría quedar el bg
            // sin la curva personalizada.
            transition:
              'transform var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)',
          }}
        >
          <IconPlus size={14} />
        </button>
      )}
    </div>
  )
}

function EmptyHint({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="fz-empty-card text-brand-mid">
      <p className="text-sm font-medium text-brand">{title}</p>
      <p className="text-xs mt-1.5 leading-relaxed opacity-90 max-w-[340px] mx-auto">
        {body}
      </p>
    </div>
  )
}
