import { CATEGORIES, MOVEMENT_TYPES } from '@/lib/constants'
import type { PendingMovement } from '@/types'

// Extrae el primer bloque JSON válido de un string
// (maneja casos donde Gemini incluye texto extra o markdown)
function extractJSON(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No se encontró JSON en la respuesta')
  }
  return raw.slice(start, end + 1)
}

// Parsea y valida la respuesta de Gemini → PendingMovement[]
export function parseGeminiResponse(
  raw: string,
  fallbackDate: string
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

    valid.push({
      tempId: crypto.randomUUID(),
      type: type as PendingMovement['type'],
      amount: Math.round(amount * 100) / 100,
      description: description.trim().slice(0, 60),
      category: cat,
      movementDate: date,
    })
  }

  return valid
}
