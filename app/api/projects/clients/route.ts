/**
 * GET /api/projects/clients?q=mar
 *
 * Autocomplete de clientes/proveedores. Saca distinct client_name de los
 * proyectos del user (activos + archivados) que empiezan con `q`,
 * case-insensitive. Devuelve hasta 10 sugerencias ordenadas alfa.
 *
 * NOTA: No tenemos tabla `clients` dedicada — la lista de clientes vive
 * dentro de projects.client_name. Esto evita una tabla extra y elimina
 * problemas de sync (cliente renombrado, cliente borrado, etc.).
 */

import { createClient } from '@/lib/supabase/server'
import { assertProAndGetProfile } from '@/lib/projects/helpers'

const MAX_SUGGESTIONS = 10

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await assertProAndGetProfile(supabase)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const qRaw = searchParams.get('q') ?? ''
  const q = qRaw.trim().slice(0, 60)

  // Sin query: devuelve los 10 más recientes (útil para mostrar opciones
  // por default si el user abre el autocomplete sin teclear).
  let query = supabase
    .from('projects')
    .select('client_name, updated_at')
    .eq('user_id', auth.userId)
    .not('client_name', 'is', null)

  if (q.length > 0) {
    // ilike '<q>%' — case-insensitive prefix match.
    // v0.63: escapar wildcards SQL `%` y `_` para que un cliente llamado "50%"
    // o "ABC_Co" matchee literal en vez de actuar como pattern.
    const safe = q.replace(/[\\%_]/g, c => `\\${c}`)
    query = query.ilike('client_name', `${safe}%`)
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(50)

  if (error) {
    console.error('[GET /api/projects/clients]', error)
    return Response.json({ error: 'No se pudo buscar' }, { status: 500 })
  }

  // Distinct preservando el orden (más reciente primero).
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of data ?? []) {
    const name = (row as { client_name: string | null }).client_name
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= MAX_SUGGESTIONS) break
  }

  return Response.json({ suggestions: out })
}
