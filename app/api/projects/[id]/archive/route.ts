/**
 * POST /api/projects/[id]/archive
 *
 * Archiva un proyecto. Comportamiento (default sr-engineer aprobado v0.5):
 *   - Proyecto pasa a status='archived', archived_at=NOW().
 *   - Movimientos del proyecto NO se tocan. Siguen contando en métricas globales
 *     salvo que el user apague profiles.include_archived_in_metrics.
 *   - Pendientes asociados (movements.project_id=X, type='pendiente') SIGUEN
 *     vivos — son plata real por cobrar/pagar; esconderlos sería peligroso.
 *   - Recurrentes asociados (recurring_movements.project_id=X) se PAUSAN
 *     (is_active=false). Si el user reabre, NO se reactivan automáticamente;
 *     debe ir a /recurrentes y reactivarlos manualmente.
 *
 * Devuelve el proyecto actualizado + conteos de qué pasó con pendientes/recurrentes
 * para que el UI pueda mostrar un toast informativo.
 */

import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import {
  assertProAndGetProfile,
  mapDbProject,
  type ProjectDbRow,
} from '@/lib/projects/helpers'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  // Verificar ownership y estado actual (idempotente: si ya estaba archivado, ok).
  const { data: current, error: getErr } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single()

  if (getErr || !current) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  // Contar pendientes activos del proyecto antes de archivar (info al user).
  const { count: pendingCount } = await supabase
    .from('movements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .eq('project_id', id)
    .eq('type', 'pendiente')

  // Archivar el proyecto PRIMERO. Si falla, no tocamos recurrentes (evita
  // estado inconsistente: recurrentes pausados pero proyecto sigue activo).
  // El trigger de DB setea archived_at automáticamente.
  const { data: updated, error: updateErr } = await supabase
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .single()

  if (updateErr || !updated) {
    console.error('[POST /api/projects/:id/archive]', updateErr)
    return Response.json({ error: 'No se pudo archivar' }, { status: 500 })
  }

  // Pausar recurrentes activos del proyecto DESPUÉS de archivar. Si esto falla
  // los recurrentes siguen activos y el siguiente ciclo de materialización
  // generará pendientes — no rompe nada, solo es UX inesperada. Fail-soft.
  const { data: pausedRecurring } = await supabase
    .from('recurring_movements')
    .update({ is_active: false })
    .eq('user_id', auth.userId)
    .eq('project_id', id)
    .eq('is_active', true)
    .select('id')

  const pausedCount = pausedRecurring?.length ?? 0
  await trackServer(supabase, auth.userId, 'project_archived', {
    project_id: id,
    pending_count: pendingCount ?? 0,
    paused_recurring_count: pausedCount,
  })

  return Response.json({
    project: mapDbProject(updated as ProjectDbRow),
    pendingMovementsAffected: pendingCount ?? 0,
    pausedRecurringCount: pausedCount,
  })
}
