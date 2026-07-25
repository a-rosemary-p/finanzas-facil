// Rate limiting por IP para endpoints PÚBLICOS (sin sesión).
//
// Complemento de `lib/rate-limit.ts`, que limita por `user_id` y por lo tanto
// solo aplica a usuarios autenticados. Los endpoints públicos (/api/feedback,
// /api/track) no tienen user_id, así que se limitan por IP contra la tabla
// `ip_rate_limits` (migración 033).
//
// La RPC `check_ip_rate_limit` está revocada de PUBLIC y otorgada solo a
// service_role — ningún cliente puede llamarla, así que no se puede envenenar
// el contador de otra IP (el problema que tenía `check_rate_limit` antes de la
// migración 030).

import { createClient } from '@supabase/supabase-js'

export type IpRateLimitBucket = 'feedback_public' | 'track'

interface BucketConfig {
  limit: number
  windowSeconds: number
}

// Límites pensados para no tocar NUNCA a un humano real, solo frenar bots.
const CONFIGS: Record<IpRateLimitBucket, BucketConfig> = {
  // Manda correo vía Resend. Un humano no manda 8 comentarios en una hora.
  feedback_public: { limit: 8, windowSeconds: 3600 },
  // `page_viewed` dispara en cada navegación; una sesión intensa puede generar
  // varias docenas. 300/hora deja holgura enorme y aun así corta el scripting.
  track:           { limit: 300, windowSeconds: 3600 },
}

/**
 * Extrae la IP del cliente de los headers del request.
 *
 * En Vercel, `x-forwarded-for` viene como lista "cliente, proxy1, proxy2" —
 * el primer valor es el cliente real. Se cae a `x-real-ip` y finalmente a
 * 'unknown' (que agrupa a todos los que no traen headers; aceptable porque
 * en producción detrás de Vercel siempre vienen).
 */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Consume una unidad del rate limit de la IP para el bucket dado.
 *
 * Falla-abierto igual que `consumeRateLimit`: si la DB o la config fallan,
 * permitimos la request. Preferimos un abuso ocasional sobre bloquear tráfico
 * legítimo por un problema transitorio nuestro. En estos dos endpoints el
 * peor caso de un fallo abierto es acotado (correos a nuestra propia bandeja /
 * filas de analytics), no pérdida de datos del usuario.
 */
export async function consumeIpRateLimit(
  request: Request,
  bucket: IpRateLimitBucket,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return true // fail-open

  const cfg = CONFIGS[bucket]
  try {
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await admin.rpc('check_ip_rate_limit', {
      p_ip: getClientIp(request),
      p_bucket: bucket,
      p_limit: cfg.limit,
      p_window_seconds: cfg.windowSeconds,
    })
    if (error) {
      console.error('[ip-rate-limit]', bucket, error.message)
      return true // fail-open
    }
    return data === true
  } catch (e) {
    console.error('[ip-rate-limit]', bucket, e instanceof Error ? e.message : String(e))
    return true // fail-open
  }
}
