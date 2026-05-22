/**
 * /api/projects
 *
 * GET  — Lista de proyectos del user con summaries.
 *        Query: ?status=active|archived|all (default 'active')
 *        Devuelve [{ ...project, summary }] ordenado por última actividad desc.
 *
 * POST — Crea proyecto.
 *        Body: { name, clientName?, notes? }
 *        Valida: Pro, tope 10 activos, name 1-60.
 *        Códigos: 403 PRO_REQUIRED, 409 MAX_ACTIVE_PROJECTS, 400 inválido.
 */

import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'
import {
  assertProAndGetProfile,
  countActiveProjects,
  mapDbProject,
  aggregateProjectSummaries,
  emptySummary,
  MAX_ACTIVE_PROJECTS,
  MAX_NAME_LEN,
  MAX_CLIENT_LEN,
  MAX_NOTES_LEN,
  type ProjectDbRow,
  type MovementAggInput,
} from '@/lib/projects/helpers'
import type { ProjectWithSummary, CreateProjectInput } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') ?? 'active'
  const validStatus = statusParam === 'archived' || statusParam === 'all' ? statusParam : 'active'

  let query = supabase
    .from('projects')
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .eq('user_id', auth.userId)

  if (validStatus !== 'all') {
    query = query.eq('status', validStatus)
  }

  const { data: rows, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    console.error('[GET /api/projects]', error)
    return Response.json({ error: 'No se pudo cargar proyectos' }, { status: 500 })
  }

  const projects = (rows ?? []) as ProjectDbRow[]
  if (projects.length === 0) {
    return Response.json({ projects: [], cap: MAX_ACTIVE_PROJECTS })
  }

  // Una sola query para sacar summaries de todos los proyectos del user a la vez.
  const projectIds = projects.map(p => p.id)
  const { data: movs } = await supabase
    .from('movements')
    .select('project_id, type, amount, movement_date, is_investment')
    .eq('user_id', auth.userId)
    .in('project_id', projectIds)

  const summaries = aggregateProjectSummaries((movs ?? []) as MovementAggInput[])

  // Combinar y ordenar por última actividad (max(movement_date, updated_at)).
  const withSummary: ProjectWithSummary[] = projects.map(p => {
    const s = summaries.get(p.id) ?? emptySummary(p.id)
    // Fusionar updated_at del proyecto como señal de actividad también (renombrar
    // un proyecto sube su orden — es feedback útil al user que tocó algo).
    const lastFromMovs = s.lastActivityAt ?? ''
    const fused = lastFromMovs > p.updated_at ? lastFromMovs : p.updated_at
    return {
      ...mapDbProject(p),
      summary: { ...s, lastActivityAt: fused },
    }
  })

  withSummary.sort((a, b) => {
    const al = a.summary.lastActivityAt ?? ''
    const bl = b.summary.lastActivityAt ?? ''
    return bl.localeCompare(al)
  })

  return Response.json({ projects: withSummary, cap: MAX_ACTIVE_PROJECTS })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  let body: Partial<CreateProjectInput>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  // Validación
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length === 0 || name.length > MAX_NAME_LEN) {
    return Response.json(
      { error: `El nombre debe tener 1-${MAX_NAME_LEN} caracteres.` },
      { status: 400 },
    )
  }

  let clientName: string | null = null
  if (body.clientName !== undefined && body.clientName !== null) {
    const c = String(body.clientName).trim()
    if (c.length > MAX_CLIENT_LEN) {
      return Response.json(
        { error: `El cliente debe tener máximo ${MAX_CLIENT_LEN} caracteres.` },
        { status: 400 },
      )
    }
    clientName = c.length > 0 ? c : null
  }

  let notes: string | null = null
  if (body.notes !== undefined && body.notes !== null) {
    const n = String(body.notes).trim()
    if (n.length > MAX_NOTES_LEN) {
      return Response.json(
        { error: `Las notas deben tener máximo ${MAX_NOTES_LEN} caracteres.` },
        { status: 400 },
      )
    }
    notes = n.length > 0 ? n : null
  }

  // Pre-check del tope (defense-in-depth además del trigger DB).
  const activeCount = await countActiveProjects(supabase, auth.userId)
  if (activeCount >= MAX_ACTIVE_PROJECTS) {
    return Response.json(
      {
        error: `Llegaste al tope de ${MAX_ACTIVE_PROJECTS} proyectos activos. Archiva uno antes de crear otro.`,
        code: 'MAX_ACTIVE_PROJECTS',
      },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: auth.userId,
      name,
      client_name: clientName,
      notes,
      status: 'active',
    })
    .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
    .single()

  if (error || !data) {
    // El trigger DB puede lanzar max_active_projects_exceeded si ganamos
    // una carrera concurrente. Mapeamos al mismo 409.
    if (error?.message?.includes('max_active_projects_exceeded')) {
      return Response.json(
        {
          error: `Llegaste al tope de ${MAX_ACTIVE_PROJECTS} proyectos activos.`,
          code: 'MAX_ACTIVE_PROJECTS',
        },
        { status: 409 },
      )
    }
    // UNIQUE INDEX violation (migration 025): otra request paralela ya creó
    // un proyecto activo con el mismo nombre. Buscamos y reusamos su id en
    // lugar de devolver error — es lo que el user quería.
    if (error?.code === '23505' || error?.message?.includes('projects_user_active_name_lower_uq')) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id, user_id, name, client_name, status, notes, created_at, updated_at, archived_at')
        .eq('user_id', auth.userId)
        .eq('status', 'active')
        .ilike('name', name)
        .maybeSingle()
      if (existing) {
        return Response.json({ project: mapDbProject(existing as ProjectDbRow), reused: true })
      }
    }
    console.error('[POST /api/projects]', error)
    return Response.json({ error: 'No se pudo crear el proyecto' }, { status: 500 })
  }

  await trackServer(supabase, auth.userId, 'project_created', {
    project_id: data.id,
    has_client: !!clientName,
    source: 'projects_page',
  })

  return Response.json({ project: mapDbProject(data as ProjectDbRow) })
}
