'use client'

/**
 * /pendientes — página separada para los compromisos pendientes (Sprint 1a).
 *
 * Dos tabs:
 *   - "Pendientes": dos secciones (Vencidos arriba, Próximos abajo).
 *     Cada fila tiene Pagar + Editar (que incluye Borrar).
 *   - "Recurrentes": placeholder por ahora — el feature completo viene en
 *     Sprint 3 (DB schema ya existe, falta API CRUD + UI form + cron).
 *
 * Vive separada de /registros porque /registros (post-rediseño v0.27) tiene
 * un único propósito: registrar. Pendientes son una vista de gestión, no
 * de captura — vivían mezclados antes y la página principal se sentía
 * cargada.
 */

import { useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { usePendings } from '@/hooks/use-pendings'
import { useRecurring } from '@/hooks/use-recurring'
import { PendingRow } from '@/components/pendientes/pending-row'
import { RecurringRow } from '@/components/pendientes/recurring-row'

type Tab = 'pendientes' | 'recurrentes'

export default function PendientesPage() {
  const [tab, setTab] = useState<Tab>('pendientes')
  const { overdue, upcoming, loading, markAsPaid, updatePending, deletePending } = usePendings()

  const total = overdue.length + upcoming.length

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)' }}>
      <AppHeader />

      <main
        className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--brand)' }}>Pendientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--brand-mid)' }}>
            Compromisos por pagar y movimientos que se repiten.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--brand-chip)', border: '1px solid var(--brand-border)' }}
        >
          <TabButton active={tab === 'pendientes'} onClick={() => setTab('pendientes')}>
            Pendientes
            {total > 0 && (
              <span
                className="ml-1.5 text-[10px] font-bold px-1.5 rounded-full"
                style={{
                  background: overdue.length > 0 ? 'var(--danger)' : 'var(--brand)',
                  color: '#fff',
                  minWidth: 18,
                  display: 'inline-block',
                  textAlign: 'center',
                  lineHeight: '16px',
                }}
              >
                {total}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === 'recurrentes'} onClick={() => setTab('recurrentes')}>
            Recurrentes
          </TabButton>
        </div>

        {tab === 'pendientes' && (
          <PendientesTab
            overdue={overdue}
            upcoming={upcoming}
            loading={loading}
            markAsPaid={markAsPaid}
            updatePending={updatePending}
            deletePending={deletePending}
          />
        )}

        {tab === 'recurrentes' && <RecurrentesTab />}
      </main>
    </div>
  )
}

function TabButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-sm font-bold rounded-lg min-h-[40px] px-3 transition-colors"
      style={{
        background: active ? 'var(--brand)' : 'transparent',
        color: active ? '#fff' : 'var(--brand-mid)',
      }}
    >
      {children}
    </button>
  )
}

interface PendientesTabProps {
  overdue: ReturnType<typeof usePendings>['overdue']
  upcoming: ReturnType<typeof usePendings>['upcoming']
  loading: boolean
  markAsPaid: ReturnType<typeof usePendings>['markAsPaid']
  updatePending: ReturnType<typeof usePendings>['updatePending']
  deletePending: ReturnType<typeof usePendings>['deletePending']
}

function PendientesTab({ overdue, upcoming, loading, markAsPaid, updatePending, deletePending }: PendientesTabProps) {
  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-8 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px dashed var(--brand-border)',
          color: 'var(--brand-mid)',
        }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Sin pendientes</p>
        <p className="text-xs mt-1.5" style={{ opacity: 0.85 }}>
          Cuando registres un compromiso por pagar (ej. <i>&ldquo;mañana pago la renta&rdquo;</i>), aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {overdue.length > 0 && (
        <Section title="Vencidos" tone="danger" count={overdue.length}>
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
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Próximos" tone="default" count={upcoming.length}>
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
        </Section>
      )}
    </div>
  )
}

function Section({
  title, tone, count, children,
}: {
  title: string
  tone: 'danger' | 'default'
  count: number
  children: React.ReactNode
}) {
  const color = tone === 'danger' ? 'var(--expense-text)' : 'var(--brand-mid)'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-xs font-bold uppercase"
          style={{ letterSpacing: '0.08em', color }}
        >
          {title}
        </h2>
        <span className="text-xs" style={{ color }}>
          {count} {count === 1 ? 'compromiso' : 'compromisos'}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function RecurrentesTab() {
  const { recurring, loading, update, remove } = useRecurring()

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Cargando...</p>
  }

  if (recurring.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-8 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px dashed var(--brand-border)',
          color: 'var(--brand-mid)',
        }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Sin recurrentes</p>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ opacity: 0.9, maxWidth: 340, margin: '6px auto 0' }}>
          Cuando registres algo y digas <i>&ldquo;cada mes&rdquo;</i>, <i>&ldquo;semanal&rdquo;</i>, etc., Fiza lo detecta y aparece aquí. Cada pago activo se materializa como pendiente cuando el anterior se paga.
        </p>
      </div>
    )
  }

  const active = recurring.filter(r => r.isActive)
  const paused = recurring.filter(r => !r.isActive)

  return (
    <div className="flex flex-col gap-5">
      {active.length > 0 && (
        <RecurringSection title="Activos" count={active.length}>
          {active.map(r => (
            <RecurringRow key={r.id} rec={r} onUpdate={update} onDelete={remove} />
          ))}
        </RecurringSection>
      )}
      {paused.length > 0 && (
        <RecurringSection title="Pausados" count={paused.length}>
          {paused.map(r => (
            <RecurringRow key={r.id} rec={r} onUpdate={update} onDelete={remove} />
          ))}
        </RecurringSection>
      )}
    </div>
  )
}

function RecurringSection({
  title, count, children,
}: {
  title: string; count: number; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-xs font-bold uppercase"
          style={{ letterSpacing: '0.08em', color: 'var(--brand-mid)' }}
        >
          {title}
        </h2>
        <span className="text-xs" style={{ color: 'var(--brand-mid)' }}>
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}
