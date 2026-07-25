-- ============================================================
-- 030_lockdown_rpc_and_index.sql
--
-- Hallazgos de la auditoría de seguridad + performance (21 jul 2026).
--
-- CONTEXTO: Supabase expone TODA función del schema `public` como endpoint
-- REST en `/rest/v1/rpc/<nombre>`, y por default otorga EXECUTE a `anon` y
-- `authenticated`. Eso convirtió 12 funciones internas (triggers, helpers de
-- cron) en endpoints públicos invocables con solo el anon key. El middleware
-- de Next NO protege esos paths: van directo a PostgREST.
--
-- Verificado antes de revocar (para no romper prod):
--   • Un grep de `.rpc(` en todo el repo devuelve UNA sola llamada:
--     `check_rate_limit` (lib/rate-limit.ts:57), ejecutada con el JWT del
--     propio usuario (rol `authenticated`).
--   • Los 2 cron jobs (`materialize-overdue-recurrings`, `reset-movements-today`)
--     corren como `postgres` (superuser), que ignora los grants.
--   • Postgres NO chequea privilegio EXECUTE al disparar un TRIGGER, así que
--     revocar EXECUTE en funciones de trigger no afecta su ejecución normal.
--
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cerrar las 11 funciones internas que NO se llaman por RPC.
--
--    La más grave era `materialize_next_pending(uuid)`: SECURITY DEFINER, sin
--    verificación de ownership, y operaba sobre `v_rec.user_id` (el dueño de
--    la fila, NO quien llama). Con el UUID de un recurrente ajeno, cualquier
--    usuario autenticado podía forzar la materialización de un pendiente en
--    la cuenta de otra persona y avanzarle su `next_due_date` (tampering de
--    integridad sobre datos de terceros).
--
--    Se revoca en bloque en vez de agregar checks de auth.uid() adentro,
--    porque ninguna de estas funciones tiene razón de ser invocable por un
--    cliente: son mecánica interna de triggers y cron.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.materialize_next_pending(uuid)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.materialize_overdue_recurrings()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_daily_movement_counters()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_daily_movements()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_free_plan_limit()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_max_active_projects()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_email_to_profile()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_projects_timestamps()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_total_movements()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                   FROM anon, authenticated;

-- ------------------------------------------------------------
-- 2. `check_rate_limit`: la ÚNICA que la app sí llama por RPC.
--
--    Se queda con EXECUTE para `authenticated` (si se revoca, el rate
--    limiting deja de funcionar — y como `consumeRateLimit` falla-abierto,
--    lo haría en SILENCIO, dejando los endpoints de OpenAI sin límite).
--
--    Dos cambios:
--      a) REVOKE para `anon` — no hay flujo anónimo que necesite consumir
--         rate limit hoy.
--      b) Guard de ownership adentro. Antes, cualquier cliente podía llamarla
--         con el `p_user_id` de una víctima y un `p_limit` bajo para inflar su
--         contador y dejarla bloqueada con 429 en /api/entry, /entry/photo,
--         /transcribe e /insights (DoS dirigido). También permitía insertar
--         filas con buckets/UUIDs arbitrarios y bloatear `rate_limits`.
--
--    El guard usa `auth.uid() IS NOT NULL AND ...` a propósito: en contexto
--    service_role `auth.uid()` es NULL, y ese rol es confiable (lo usan cron
--    y jobs server-side), así que debe seguir pasando.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id        uuid,
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_window_start  TIMESTAMPTZ;
  v_count         INTEGER;
  v_caller        uuid := auth.uid();
BEGIN
  -- Un usuario autenticado solo puede consumir SU propio rate limit.
  -- service_role (auth.uid() NULL) pasa: es confiable.
  IF v_caller IS NOT NULL AND p_user_id <> v_caller THEN
    RAISE EXCEPTION 'rate_limit_user_mismatch'
      USING ERRCODE = 'P0001',
            HINT = 'p_user_id debe ser el del usuario autenticado';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from NOW()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limits (user_id, bucket, window_start, count)
  VALUES (p_user_id, p_bucket, v_window_start, 1)
  ON CONFLICT (user_id, bucket, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM anon;

-- ------------------------------------------------------------
-- 3. Restaurar el pin de `search_path` en `reset_daily_movement_counters`.
--
--    Regresión: la migración 007 pineó el search_path de las 5 funciones
--    SECURITY DEFINER vía ALTER FUNCTION. La 017 hizo CREATE OR REPLACE de
--    esta función sin re-declarar `SET search_path`, y por semántica de
--    CREATE OR REPLACE eso descarta el pin. La 029 restauró el de
--    count_daily_movements y enforce_free_plan_limit, pero esta quedó.
--    Verificado en prod: la función usa CDMX correctamente pero sin pin.
-- ------------------------------------------------------------
ALTER FUNCTION public.reset_daily_movement_counters()
  SET search_path = pg_catalog, public;

-- ------------------------------------------------------------
-- 4. Índice faltante para la query más frecuente de la app.
--
--    `/api/movements?sort=recent` (app/api/movements/route.ts) filtra por
--    user_id y ordena por created_at DESC — lo dispara `RecentMovements` en
--    CADA carga de /inicio. Los índices existentes cubren `movement_date`
--    (idx_movements_user_date) pero no `created_at`, así que Postgres leía
--    todas las filas del usuario y ordenaba en memoria.
--
--    Nota: sin CONCURRENTLY porque apply_migration corre en transacción; la
--    tabla es chica hoy y el lock es de milisegundos.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_movements_user_created
  ON public.movements (user_id, created_at DESC);
