import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/constants'
import { MOVEMENT_TYPES, isValidCategoryName } from '@/lib/constants'
import { materializeNextPending } from '@/lib/recurring/materialize'
import { getAppToday } from '@/lib/cdmx-date'
import { trackServer } from '@/lib/analytics-server'
import {
  countActiveProjects,
  MAX_ACTIVE_PROJECTS,
  MAX_NAME_LEN as PROJ_NAME_MAX,
  MAX_CLIENT_LEN as PROJ_CLIENT_MAX,
} from '@/lib/projects/helpers'
import type { Entry, Movement, ProjectSuggestion } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Validar input
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { rawText, entryDate, movements, inputSource } = body as Record<string, unknown>

    // Whitelist estricta. 'text' es el default histórico — si el cliente no
    // manda nada, asumimos texto (compat con onboarding y otros callers viejos).
    const safeInputSource: 'text' | 'voice' | 'photo' =
      inputSource === 'voice' ? 'voice'
      : inputSource === 'photo' ? 'photo'
      : 'text'

    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      return Response.json({ error: 'Texto original requerido' }, { status: 400 })
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof entryDate !== 'string' || !dateRegex.test(entryDate)) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    if (!Array.isArray(movements) || movements.length === 0) {
      return Response.json({ error: 'Debe haber al menos un movimiento' }, { status: 400 })
    }

    // Sanitizar movimientos recibidos del cliente
    const sanitized = movements
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .filter(m => MOVEMENT_TYPES.includes(m['type'] as (typeof MOVEMENT_TYPES)[number]))
      .filter(m => typeof m['amount'] === 'number' && isFinite(m['amount'] as number) && (m['amount'] as number) > 0)
      .filter(m => typeof m['description'] === 'string' && (m['description'] as string).trim().length > 0)
      .map(m => {
        const type = m['type'] as Movement['type']
        const rawDir = m['pendingDirection']
        // Solo pendientes pueden tener dirección. ingreso/gasto la ignoran.
        const pendingDirection: 'ingreso' | 'gasto' | null =
          type === 'pendiente'
            ? (rawDir === 'ingreso' ? 'ingreso' : 'gasto')
            : null

        const rawFreq = m['recurringFrequency']
        const recurringFrequency: 'week' | 'month' | 'year' | null =
          rawFreq === 'week' || rawFreq === 'month' || rawFreq === 'year' ? rawFreq : null
        const isRecurring = m['isRecurring'] === true && recurringFrequency !== null

        // Proyectos (v0.5): aceptamos projectId (existente) y/o projectCreateName
        // (crear nuevo). projectSuggestion es solo metadata para audit.
        const rawProjId = m['projectId']
        const projectId = typeof rawProjId === 'string' && rawProjId.length > 0 ? rawProjId : null

        const rawCreate = m['projectCreateName']
        const projectCreateName =
          typeof rawCreate === 'string' && rawCreate.trim().length > 0
            ? rawCreate.trim().slice(0, PROJ_NAME_MAX)
            : null

        const rawSug = m['projectSuggestion']
        let projectSuggestion: ProjectSuggestion | null = null
        if (rawSug && typeof rawSug === 'object') {
          const s = rawSug as Record<string, unknown>
          const conf = s['confidence']
          projectSuggestion = {
            projectId: typeof s['projectId'] === 'string' ? (s['projectId'] as string) : null,
            createName: typeof s['createName'] === 'string'
              ? ((s['createName'] as string).slice(0, PROJ_NAME_MAX))
              : null,
            confidence: conf === 'high' ? 'high' : 'low',
          }
        }

        return {
          type,
          amount: Math.round((m['amount'] as number) * 100) / 100,
          description: (m['description'] as string).trim().slice(0, 60),
          category: isValidCategoryName(m['category'])
            ? (m['category'] as Movement['category'])
            : ('Otro' as const),
          movementDate:
            typeof m['movementDate'] === 'string' && dateRegex.test(m['movementDate'] as string)
              ? (m['movementDate'] as string)
              : entryDate,
          isInvestment: m['isInvestment'] === true,
          originalAmount:
            typeof m['originalAmount'] === 'number' ? (m['originalAmount'] as number) : (m['amount'] as number),
          originalCurrency:
            m['originalCurrency'] === 'USD' ? 'USD' : m['originalCurrency'] === 'EUR' ? 'EUR' : 'MXN',
          exchangeRateUsed:
            typeof m['exchangeRateUsed'] === 'number' ? (m['exchangeRateUsed'] as number) : 1,
          pendingDirection,
          isRecurring,
          recurringFrequency,
          projectId,
          projectCreateName,
          projectSuggestion,
        }
      })

    if (sanitized.length === 0) {
      return Response.json({ error: 'No hay movimientos válidos' }, { status: 400 })
    }

    // 3. Re-verificar límite en servidor (fuente de verdad)
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, movements_today, movements_today_date')
      .eq('id', user.id)
      .single()

    const isPro = profile?.plan === 'pro'

    if (profile && profile.plan === 'free') {
      const today = getAppToday()
      const isToday = profile.movements_today_date === today
      const usedToday = isToday ? (profile.movements_today as number) : 0
      const remaining = PLANS.FREE.maxMovementsPerDay - usedToday

      if (sanitized.length > remaining) {
        // Señal fuerte de intent Pro — alguien tratando de meter más
        // movimientos de los permitidos por el plan Free.
        await trackServer(supabase, user.id, 'free_limit_blocked', {
          attempted: sanitized.length,
          remaining,
          input_source: safeInputSource,
        })
        return Response.json(
          {
            error: 'LIMIT_EXCEEDED',
            message: `Solo te quedan ${remaining} movimiento(s) hoy en el plan Free. Elimina algunos o actualiza a Pro.`,
            remaining,
          },
          { status: 429 }
        )
      }
    }

    // 3.5. Resolver proyectos (v0.5):
    //   - Si el user NO es Pro, ignoramos cualquier projectId/projectCreateName.
    //   - Si es Pro y vino projectCreateName, creamos los proyectos antes del
    //     insert de movements (deduplicando por nombre case-insensitive contra
    //     proyectos activos existentes y entre sí en el mismo confirm).
    //   - Validamos tope de 10 activos. Si la creación pasaría el tope, devolvemos
    //     409 y abortamos la entry entera. Mejor abortar fuerte que crear movs
    //     sin el proyecto que el user esperaba.
    //
    // Mapa nombre_lowercase → projectId (real). Para deduplicar dentro del batch.
    const createdProjectByName = new Map<string, string>()
    if (isPro) {
      // Recolectar nombres únicos a crear. Si un mov ya tiene projectId
      // resuelto, ignoramos su projectCreateName aunque venga (defense-in-depth
      // contra que el cliente o el parser de IA dejaron ambos puestos).
      const namesToCreate = new Set<string>()
      for (const s of sanitized) {
        if (s.projectId) continue
        if (s.projectCreateName) {
          namesToCreate.add(s.projectCreateName.toLowerCase())
        }
      }

      if (namesToCreate.size > 0) {
        // ¿Alguno ya existe activo? Si sí, no crear — reusar id.
        const { data: existing } = await supabase
          .from('projects')
          .select('id, name, status')
          .eq('user_id', user.id)
          .eq('status', 'active')

        const existingByName = new Map<string, string>()
        for (const row of existing ?? []) {
          existingByName.set(
            ((row as { name: string }).name).toLowerCase(),
            (row as { id: string }).id,
          )
        }

        // Calcular cuántos nuevos vamos a tener que crear (que no existan).
        let toCreate: string[] = []
        for (const s of sanitized) {
          if (s.projectId) continue   // ya resuelto, no crear
          if (!s.projectCreateName) continue
          const key = s.projectCreateName.toLowerCase()
          if (existingByName.has(key)) {
            createdProjectByName.set(key, existingByName.get(key)!)
            continue
          }
          if (!toCreate.find(t => t.toLowerCase() === key)) {
            toCreate.push(s.projectCreateName)
          }
        }

        if (toCreate.length > 0) {
          const activeCount = await countActiveProjects(supabase, user.id)
          if (activeCount + toCreate.length > MAX_ACTIVE_PROJECTS) {
            return Response.json(
              {
                error: `Crear estos proyectos pasaría el tope de ${MAX_ACTIVE_PROJECTS} activos. Archiva alguno o quita los nuevos.`,
                code: 'MAX_ACTIVE_PROJECTS',
              },
              { status: 409 },
            )
          }

          // Insert batch — uno por uno para que un fallo aislado no aborte todos.
          for (const name of toCreate) {
            const cleanName = name.slice(0, 60)
            const { data: newProj, error: pErr } = await supabase
              .from('projects')
              .insert({
                user_id: user.id,
                name: cleanName,
                client_name: null,
                status: 'active',
              })
              .select('id, name')
              .single()
            if (pErr || !newProj) {
              // UNIQUE violation: alguien (esta misma request en otro tab, o
              // race con /api/projects POST) ya creó un proyecto activo con
              // este nombre. Buscamos y reusamos el id en lugar de fallar.
              if (
                (pErr as { code?: string } | null)?.code === '23505' ||
                pErr?.message?.includes('projects_user_active_name_lower_uq')
              ) {
                const { data: existing } = await supabase
                  .from('projects')
                  .select('id, name')
                  .eq('user_id', user.id)
                  .eq('status', 'active')
                  .ilike('name', cleanName)
                  .maybeSingle()
                if (existing) {
                  createdProjectByName.set(
                    (existing.name as string).toLowerCase(),
                    existing.id as string,
                  )
                  continue
                }
              }
              console.error('[confirm] project create failed', pErr)
              continue
            }
            createdProjectByName.set(
              (newProj.name as string).toLowerCase(),
              newProj.id as string,
            )
            await trackServer(supabase, user.id, 'project_created', {
              project_id: newProj.id,
              source: 'confirmation',
            })
          }
        }
      }
    }

    /** Resuelve el project_id final de un movimiento sanitizado. */
    function resolveProjectId(s: (typeof sanitized)[number]): string | null {
      if (!isPro) return null
      if (s.projectId) return s.projectId
      if (s.projectCreateName) {
        return createdProjectByName.get(s.projectCreateName.toLowerCase()) ?? null
      }
      return null
    }

    // 4. Guardar entry
    const { data: entryRow, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: rawText.trim(),
        entry_date: entryDate,
        input_source: safeInputSource,
      })
      .select('id, raw_text, entry_date, created_at')
      .single()

    if (entryError || !entryRow) {
      console.error('[confirm] entry insert error', entryError)
      return Response.json({ error: 'Error al guardar la entrada' }, { status: 500 })
    }

    // 5. Guardar movements + crear recurrentes
    //
    // Sprint 3: si un movimiento tiene `isRecurring=true`, NO insertamos un
    // row directo en `movements` — en su lugar creamos un `recurring_movements`
    // que automáticamente materializa el primer pendiente vía
    // `materializeNextPending`. Sin esto tendríamos duplicados (el row directo
    // + el primer pendiente del template).
    const nonRecurring = sanitized.filter(s => !s.isRecurring)
    const recurringOnes = sanitized.filter(s => s.isRecurring && s.recurringFrequency !== null)

    let savedMovements: Array<Record<string, unknown>> = []
    let movError: { code?: string; message?: string } | null = null

    if (nonRecurring.length > 0) {
      const movementRows = nonRecurring.map(m => ({
        entry_id: entryRow.id as string,
        user_id: user.id,
        type: m.type,
        amount: m.amount,
        description: m.description,
        category: m.category,
        movement_date: m.movementDate,
        is_investment: m.isInvestment,
        original_amount: m.originalAmount,
        original_currency: m.originalCurrency,
        exchange_rate_used: m.exchangeRateUsed,
        pending_direction: m.pendingDirection,
        project_id: resolveProjectId(m),
      }))

      const { data, error } = await supabase
        .from('movements')
        .insert(movementRows)
        .select('id, type, amount, description, category, movement_date, is_investment, project_id')

      savedMovements = (data ?? []) as Array<Record<string, unknown>>
      movError = error
    }

    if (movError) {
      // El trigger BEFORE INSERT puede lanzar free_plan_limit_exceeded (P0001)
      // si una carrera concurrente pasó nuestro check anterior y la DB ya está
      // en el límite. Devolvemos el mismo 429 para que el cliente reaccione igual.
      if (movError.message?.includes('free_plan_limit_exceeded')) {
        return Response.json(
          {
            error: 'LIMIT_EXCEEDED',
            message: 'Alcanzaste el límite diario de 10 movimientos del plan Free.',
          },
          { status: 429 }
        )
      }
      console.error('[confirm] movements insert error', movError)
      return Response.json({ error: 'Error al guardar los movimientos' }, { status: 500 })
    }

    // Crear recurrentes — cada uno materializa su primer pendiente.
    // Fail-soft: si un recurrente individual falla, los demás siguen.
    for (const r of recurringOnes) {
      // Si el LLM marcó type='pendiente', usamos pending_direction como tipo
      // del template (ingreso o gasto). Ingreso/gasto directo se respetan tal cual.
      const recType: 'ingreso' | 'gasto' =
        r.type === 'pendiente'
          ? (r.pendingDirection === 'ingreso' ? 'ingreso' : 'gasto')
          : (r.type === 'ingreso' ? 'ingreso' : 'gasto')

      const { data: rec, error: recErr } = await supabase
        .from('recurring_movements')
        .insert({
          user_id: user.id,
          type: recType,
          amount: r.amount,
          description: r.description,
          category: r.category,
          frequency: r.recurringFrequency,
          next_due_date: r.movementDate,
          is_active: true,
          project_id: resolveProjectId(r),
        })
        .select('id')
        .single()

      if (recErr || !rec) {
        console.error('[confirm] recurring insert failed', recErr)
        continue
      }
      // Materializa el primer pendiente. Si falla (ej. trigger free_plan_limit
      // en el insert del pendiente), devolvemos null y el template queda
      // como huérfano — el user lo verá en /pendientes tab Recurrentes y
      // puede borrar/editar.
      await materializeNextPending(supabase, rec.id as string)
    }

    // 6. Audit trail: loguear evento 'created' por cada movimiento NO recurrente.
    // Los recurrentes loguean su propio evento 'recurring_materialized' adentro
    // del helper. Fail-soft.
    if (savedMovements.length > 0) {
      const eventRows = savedMovements.map(m => ({
        movement_id: m['id'] as string,
        user_id: user.id,
        event_type: 'created',
        payload: {
          type: m['type'],
          amount: Number(m['amount']),
          category: m['category'],
          movement_date: m['movement_date'],
          is_investment: (m['is_investment'] as boolean) ?? false,
          input_source: safeInputSource,
        },
      }))
      const { error: eventErr } = await supabase
        .from('movement_events')
        .insert(eventRows)
      if (eventErr) console.error('[confirm] events insert failed', eventErr)

      // Audit de proyectos (v0.5): para cada movimiento, si vino una sugerencia
      // de IA logueamos 'project_ai_suggested' (con qué propuso vs qué quedó);
      // si quedó asignado a un proyecto logueamos 'project_assigned' con source
      // 'ai' (si vino sugerencia consistente) o 'manual' (si el user lo cambió
      // o lo asignó sin sugerencia).
      //
      // CRÍTICO: NO asumir que savedMovements[i] corresponde a nonRecurring[i].
      // Supabase .insert().select() no garantiza orden — empíricamente sí lo
      // mantiene pero no es contractual. Reconciliamos por la tripleta
      // (amount, description, movement_date) que es suficientemente única
      // dentro de UN MISMO entry (mismo user, mismo segundo).
      function findSrc(saved: Record<string, unknown>): (typeof nonRecurring)[number] | null {
        const amt = Number(saved['amount'])
        const desc = saved['description'] as string
        const date = saved['movement_date'] as string
        return nonRecurring.find(
          n => n.amount === amt && n.description === desc && n.movementDate === date,
        ) ?? null
      }

      const projectEventRows: Array<Record<string, unknown>> = []
      for (let i = 0; i < savedMovements.length; i++) {
        const saved = savedMovements[i]!
        const src = findSrc(saved)
        if (!src) continue
        const finalProjectId = (saved['project_id'] as string | null) ?? null
        const sug = src.projectSuggestion

        if (sug) {
          projectEventRows.push({
            movement_id: saved['id'] as string,
            user_id: user.id,
            event_type: 'project_ai_suggested',
            payload: {
              description: src.description,
              suggested_project_id: sug.projectId ?? null,
              suggested_create_name: sug.createName ?? null,
              confidence: sug.confidence,
              accepted_project_id: finalProjectId,
            },
          })
        }

        if (finalProjectId) {
          // ¿La asignación final coincide con lo que la IA sugirió?
          const aiMatched =
            sug?.projectId === finalProjectId ||
            (sug?.createName != null && src.projectCreateName === sug.createName)
          projectEventRows.push({
            movement_id: saved['id'] as string,
            user_id: user.id,
            event_type: 'project_assigned',
            payload: {
              prev_project_id: null,
              new_project_id: finalProjectId,
              source: aiMatched ? 'ai' : 'manual',
            },
          })
          await trackServer(supabase, user.id, 'project_assigned', {
            movement_id: saved['id'],
            project_id: finalProjectId,
            source: aiMatched ? 'ai' : 'manual',
          })
        }
      }
      if (projectEventRows.length > 0) {
        const { error: pEvtErr } = await supabase
          .from('movement_events')
          .insert(projectEventRows)
        if (pEvtErr) console.error('[confirm] project events insert failed', pEvtErr)
      }
    }

    // 6.5. Analytics — un solo evento por entry (no uno por movimiento).
    // Esto da: "cuántas entries por usuario", "qué método usan", "cuántos
    // movimientos en promedio por entry". Fail-soft.
    await trackServer(supabase, user.id, 'entry_created', {
      input_source: safeInputSource,
      movements_count: savedMovements.length,
      recurring_count: recurringOnes.length,
      had_pendiente: sanitized.some(s => s.type === 'pendiente'),
    })
    for (const r of recurringOnes) {
      await trackServer(supabase, user.id, 'recurring_created', {
        type: r.type,
        frequency: r.recurringFrequency,
        category: r.category,
      })
    }

    // 7. Devolver la entry completa
    const entry: Entry = {
      id: entryRow.id as string,
      rawText: entryRow.raw_text as string,
      entryDate: entryRow.entry_date as string,
      createdAt: entryRow.created_at as string,
      movements: savedMovements.map(m => ({
        id: m.id as string,
        type: m.type as Movement['type'],
        amount: m.amount as number,
        description: m.description as string,
        category: m.category as Movement['category'],
        movementDate: m.movement_date as string,
        isInvestment: (m.is_investment as boolean) ?? false,
        projectId: (m.project_id as string | null) ?? null,
      })),
    }

    return Response.json({ entry })
  } catch (error: unknown) {
    console.error('[POST /api/entry/confirm]', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Error al confirmar. Intenta de nuevo.' }, { status: 500 })
  }
}
