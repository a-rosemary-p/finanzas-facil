import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
import type { PendingMovement, ProjectSuggestion } from '@/types'

// Extrae el primer bloque JSON válido de un string
// (maneja casos donde el modelo incluye texto extra o markdown)
function extractJSON(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No se encontró JSON en la respuesta')
  }
  return raw.slice(start, end + 1)
}

/**
 * Parsea y valida la respuesta de la IA → PendingMovement[].
 *
 * v0.5: opcionalmente recibe `activeProjectIds` (Set<string>) para validar que
 * el modelo no haya inventado un UUID que no existe. Si el modelo devuelve un
 * projectId que no está en el set, lo descartamos (se ignora silenciosamente)
 * pero conservamos projectCreateName si vino — el user verá la sugerencia de
 * "Crear X" en la UI.
 */
export function parseGeminiResponse(
  raw: string,
  fallbackDate: string,
  activeProjectIds?: Set<string>,
): PendingMovement[] {
  const json = extractJSON(raw)
  const parsed: unknown = JSON.parse(json)

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>)['movements'])
  ) {
    throw new Error('Formato de respuesta inesperado')
  }

  const rawMovements = (parsed as Record<string, unknown[]>)['movements']

  const valid: PendingMovement[] = []

  for (const item of rawMovements) {
    if (typeof item !== 'object' || item === null) continue

    const m = item as Record<string, unknown>

    const type = m['type']
    const amount = m['amount']
    const description = m['description']
    const category = m['category']
    const movementDate = m['movementDate']

    // Validar tipo
    if (!MOVEMENT_TYPES.includes(type as (typeof MOVEMENT_TYPES)[number])) continue

    // Validar monto: número positivo y finito
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) continue

    // Validar descripción
    if (typeof description !== 'string' || description.trim() === '') continue

    // Validar/corregir categoría
    const cat = CATEGORIES.includes(category as (typeof CATEGORIES)[number])
      ? (category as PendingMovement['category'])
      : 'Otro'

    // Validar/corregir fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const date =
      typeof movementDate === 'string' && dateRegex.test(movementDate)
        ? movementDate
        : fallbackDate

    // Campos de conversión de moneda (opcionales, con defaults)
    const originalAmount =
      typeof m['originalAmount'] === 'number' && isFinite(m['originalAmount'] as number)
        ? (m['originalAmount'] as number)
        : Math.round(amount * 100) / 100

    const rawCurrency = m['originalCurrency']
    const originalCurrency: 'MXN' | 'USD' | 'EUR' =
      rawCurrency === 'USD' ? 'USD' : rawCurrency === 'EUR' ? 'EUR' : 'MXN'

    const exchangeRateUsed =
      typeof m['exchangeRateUsed'] === 'number' && isFinite(m['exchangeRateUsed'] as number)
        ? (m['exchangeRateUsed'] as number)
        : 1

    // Campo de inversión
    const isInvestment = m['isInvestment'] === true

    // Campos de recurrente / dirección de pendiente (sprint 3)
    const rawDirection = m['pendingDirection']
    const pendingDirection: 'ingreso' | 'gasto' | null =
      type === 'pendiente'
        ? (rawDirection === 'ingreso' ? 'ingreso' : rawDirection === 'gasto' ? 'gasto' : 'gasto')
        : null

    const isRecurring = m['isRecurring'] === true
    const rawFreq = m['recurringFrequency']
    const recurringFrequency: 'week' | 'month' | 'year' | null =
      isRecurring && (rawFreq === 'week' || rawFreq === 'month' || rawFreq === 'year')
        ? rawFreq
        : null
    // Si dijo isRecurring pero no dio frecuencia válida, lo desactivamos
    // (mejor no crear un recurrente sin saber cada cuánto).
    const finalIsRecurring = isRecurring && recurringFrequency !== null

    // Proyectos (v0.5). Sólo si recibimos activeProjectIds (Pro con proyectos).
    // Para usuarios sin la sección de proyectos en el prompt, el modelo no
    // debería incluir estos campos — y si los inventa, los descartamos.
    let projectId: string | null = null
    let projectCreateName: string | null = null
    let projectSuggestion: ProjectSuggestion | null = null
    if (activeProjectIds && activeProjectIds.size > 0) {
      const rawPid = m['projectId']
      const rawCreate = m['projectCreateName']
      const rawConf = m['projectConfidence']

      const confidence: 'high' | 'low' = rawConf === 'high' ? 'high' : 'low'

      // Validar projectId contra la whitelist. Si el modelo inventó un UUID
      // que no está en activeProjectIds, lo ignoramos.
      if (typeof rawPid === 'string' && activeProjectIds.has(rawPid)) {
        projectId = rawPid
      }

      // Si ya hay projectId válido, ignoramos projectCreateName aunque el
      // modelo lo haya devuelto — son mutuamente excluyentes en el confirm
      // (resolveProjectId prioriza projectId, pero la sección de creación
      // crearía un proyecto extra innecesariamente y consumiría cupo).
      if (
        !projectId &&
        typeof rawCreate === 'string' &&
        rawCreate.trim().length > 0 &&
        rawCreate.trim().length <= 60
      ) {
        projectCreateName = rawCreate.trim()
      }

      if (projectId || projectCreateName) {
        projectSuggestion = {
          projectId,
          createName: projectCreateName,
          confidence,
        }
      }
    }

    valid.push({
      tempId: crypto.randomUUID(),
      type: type as PendingMovement['type'],
      amount: Math.round(amount * 100) / 100,
      description: description.trim().slice(0, 60),
      category: cat,
      movementDate: date,
      isInvestment,
      originalAmount,
      originalCurrency,
      exchangeRateUsed,
      pendingDirection,
      isRecurring: finalIsRecurring,
      recurringFrequency,
      projectId,
      projectCreateName,
      projectSuggestion,
    })
  }

  return valid
}
