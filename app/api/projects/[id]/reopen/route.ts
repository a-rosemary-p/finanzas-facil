/**
 * POST /api/projects/[id]/reopen
 *
 * Reabre un proyecto archivado. Reglas:
 *   - Si el user ya tiene 10 proyectos activos, falla con 409 MAX_ACTIVE_PROJECTS.
 *   - Trigger DB también lo enforza.
 *   - Recurrentes NO se reactivan automáticamente. Si el user quiere que sigan,
 *     debe ir a /recurrentes y activarlos manualmente — política intencional
 *     para no sorprender al user con cargos automáticos.
 *   - status='active' + archived_at=NULL (lo hace el trigger touch_projects_timestamps).
 */

import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import {
  assertProAndGetProfile,
  countActiveProjects,
  mapDbProject,
  MAX_ACTIVE_PROJECTS,
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

  // Pre-check tope.
  const activeCount = await countActiveProjects(supabase, auth.userId)
  if (activeCount >= MAX_ACTIVE_PROJECTS) {
    return Response.json(
      {
        error: `Llegaste al tope de ${MAX_ACTIVE_PROJECTS} proyectos activos. Archiva uno antes de reabrir éste.`,
        code: 'MAX_ACTIVE_PROJECTS',
      },
      { status: 409 },
    )
  }

  // Verificar ownership + status actual antes del UPDATE. Sin esto, intentar
  // reopen sobre un id que no es del user devolvía 500 confuso vez de 404.
  const { data: current } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!current) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .single()

  if (error || !data) {
    if (error?.message?.includes('max_active_projects_exceeded')) {
      return Response.json(
        {
          error: `Llegaste al tope de ${MAX_ACTIVE_PROJECTS} proyectos activos.`,
          code: 'MAX_ACTIVE_PROJECTS',
        },
        { status: 409 },
      )
    }
    console.error('[POST /api/projects/:id/reopen]', error)
    return Response.json({ error: 'No se pudo reabrir' }, { status: 500 })
  }

  // Contar recurrentes pausados (is_active=false) que pertenecen al proyecto.
  // El UI los muestra como aviso porque NO se reactivan automáticamente — el
  // user debe ir a /recurrentes y reactivarlos manualmente si quiere que sigan.
  const { count: pausedRecurringCount } = await supabase
    .from('recurring_movements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .eq('project_id', id)
    .eq('is_active', false)

  await trackServer(supabase, auth.userId, 'project_reopened', {
    project_id: id,
    paused_recurring_count: pausedRecurringCount ?? 0,
  })

  return Response.json({
    project: mapDbProject(data as ProjectDbRow),
    pausedRecurringCount: pausedRecurringCount ?? 0,
  })
}
