// Helper para aplicar rate limiting server-side usando la función
// `check_rate_limit` de migration 008. Los límites viven aquí para ajustarse
// sin tocar SQL.

import type { SupabaseClient } from '@supabase/supabase-js'

export type RateLimitBucket = 'entry' | 'entry_photo'

interface BucketConfig {
  limit: number
  windowSeconds: number
  /** Mensaje al usuario cuando se bloquea. Español corto. */
  blockedMessage: string
}

// Límites deliberadamente generosos: un usuario humano normal NO los toca.
// Solo frenan abuso automatizado que buscaría quemar el bill de OpenAI.
const CONFIGS: Record<RateLimitBucket, BucketConfig> = {
  entry: {
    limit: 100,
    windowSeconds: 3600, // 1 hora
    blockedMessage: 'Estás mandando demasiados registros muy rápido. Espera unos minutos y vuelve a intentar.',
  },
  entry_photo: {
    limit: 30,
    windowSeconds: 3600,
    blockedMessage: 'Estás subiendo fotos demasiado rápido. Espera unos minutos y vuelve a intentar.',
  },
}

/**
 * Checa y consume una unidad del rate limit para el user + bucket.
 * Devuelve `{ ok: true }` si la request puede proceder.
 * Devuelve `{ ok: false, message, retryAfterSeconds }` si se rebasó.
 *
 * Falla-abierto: si la llamada a la DB falla, permitimos la request.
 * Preferimos un abuso ocasional sobre bloquear a usuarios legítimos cuando
 * la DB tiene un problema transitorio.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  userId: string,
  bucket: RateLimitBucket
): Promise<{ ok: true } | { ok: false; message: string; retryAfterSeconds: number }> {
  const cfg = CONFIGS[bucket]

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: cfg.limit,
    p_window_seconds: cfg.windowSeconds,
  })

  if (error) {
    // Fail-open: log y deja pasar
    console.error('[rate-limit] DB error — failing open:', error.message)
    return { ok: true }
  }

  if (data === true) return { ok: true }

  return {
    ok: false,
    message: cfg.blockedMessage,
    // Conservador: el cliente puede reintentar en la mitad de la ventana
    retryAfterSeconds: Math.floor(cfg.windowSeconds / 2),
  }
}
