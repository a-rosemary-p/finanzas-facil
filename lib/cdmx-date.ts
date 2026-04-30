/**
 * Fecha "hoy" en zona horaria de la app (America/Mexico_City).
 *
 * Toda la lógica de "movimientos hoy" / límite Free / reset diario debe
 * usar esto, NO `new Date().toISOString().slice(0,10)` (que usa UTC) ni
 * `new Date().toLocaleDateString()` (que usa la TZ del browser/server).
 *
 * En SQL la equivalencia es `(NOW() AT TIME ZONE 'America/Mexico_City')::date`.
 */

export const APP_TIMEZONE = 'America/Mexico_City'

/** YYYY-MM-DD en CDMX, sin importar dónde corra el caller. */
export function getAppToday(): string {
  // 'en-CA' formatea YYYY-MM-DD por default. timeZone fija el cálculo a CDMX.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}
