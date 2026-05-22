/**
 * /api/projects/[id]
 *
 * GET    — Detalle del proyecto + summary agregado + timeseries para chart.
 * PATCH  — Editar name / clientName / notes.
 * DELETE — Hard-delete. Movimientos quedan con project_id=NULL (ON DELETE SET NULL).
 *          Recurrentes asociados también se desasignan (mismo SET NULL).
 *
 * El status (active/archived) se mueve via endpoints dedicados /archive y /reopen.
 */

import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import {
  assertProAndGetProfile,
  mapDbProject,
  aggregateProjectSummaries,
  emptySummary,
  bucketByMonthOrWeek,
  MAX_NAME_LEN,
  MAX_CLIENT_LEN,
  MAX_NOTES_LEN,
  type ProjectDbRow,
  type MovementAggInput,
} from '@/lib/projects/helpers'
import type { UpdateProjectInput } from '@/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  const { data: proj, error } = await supabase
    .from('projects')
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single()

  if (error || !proj) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  // Movimientos del proyecto — para summary + chart + listas inline.
  const { data: movs } = await supabase
    .from('movements')
    .select('project_id, type, amount, movement_date, is_investment')
    .eq('user_id', auth.userId)
    .eq('project_id', id)

  const movsTyped = (movs ?? []) as MovementAggInput[]
  const summaryMap = aggregateProjectSummaries(movsTyped)
  const summary = summaryMap.get(id) ?? emptySummary(id)
  const chart = bucketByMonthOrWeek(movsTyped)

  return Response.json({
    project: mapDbProject(proj as ProjectDbRow),
    summary,
    chart,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  let body: Partial<UpdateProjectInput>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length === 0 || name.length > MAX_NAME_LEN) {
      return Response.json(
        { error: `El nombre debe tener 1-${MAX_NAME_LEN} caracteres.` },
        { status: 400 },
      )
    }
    patch.name = name
  }

  if (body.clientName !== undefined) {
    if (body.clientName === null) {
      patch.client_name = null
    } else {
      const c = String(body.clientName).trim()
      if (c.length > MAX_CLIENT_LEN) {
        return Response.json(
          { error: `El cliente debe tener máximo ${MAX_CLIENT_LEN} caracteres.` },
          { status: 400 },
        )
      }
      patch.client_name = c.length > 0 ? c : null
    }
  }

  if (body.notes !== undefined) {
    if (body.notes === null) {
      patch.notes = null
    } else {
      const n = String(body.notes).trim()
      if (n.length > MAX_NOTES_LEN) {
        return Response.json(
          { error: `Las notas deben tener máximo ${MAX_NOTES_LEN} caracteres.` },
          { status: 400 },
        )
      }
      patch.notes = n.length > 0 ? n : null
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .single()

  if (error || !data) {
    console.error('[PATCH /api/projects/:id]', error)
    return Response.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }

  return Response.json({ project: mapDbProject(data as ProjectDbRow) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  // Listamos los movs que van a quedar huérfanos. Necesitamos los IDs para
  // emitir events 'project_assigned' (prev=X → new=null, source='project_deleted')
  // ANTES del delete — porque después de delete el FK CASCADE/SET NULL ya
  // habrá actualizado movements.project_id a null y no podríamos asociar.
  const { data: affectedMovs } = await supabase
    .from('movements')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('project_id', id)
  const affectedIds = (affectedMovs ?? []).map(r => (r as { id: string }).id)

  // Emitir el audit ANTES del delete. Fail-soft — si esto falla, igual seguimos
  // con el delete (el user pidió eliminar; audit es bonus).
  if (affectedIds.length > 0) {
    const eventRows = affectedIds.map(mid => ({
      movement_id: mid,
      user_id: auth.userId,
      event_type: 'project_assigned',
      payload: {
        prev_project_id: id,
        new_project_id: null,
        source: 'project_deleted',
      },
    }))
    const { error: evtErr } = await supabase.from('movement_events').insert(eventRows)
    if (evtErr) console.error('[DELETE /api/projects/:id] events failed', evtErr)
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('[DELETE /api/projects/:id]', error)
    return Response.json({ error: 'No se pudo eliminar' }, { status: 500 })
  }

  await trackServer(supabase, auth.userId, 'project_deleted', {
    project_id: id,
    orphaned_movements: affectedIds.length,
  })

  return Response.json({ deleted: true, orphanedMovements: affectedIds.length })
}
