-- ============================================================
-- 033_ip_rate_limits.sql
--
-- Rate limiting por IP para los dos endpoints PÚBLICOS (sin sesión):
--   • POST /api/feedback — hoy solo tiene un honeypot como anti-abuso. Un bot
--     que lo ignore puede mandar correos ilimitados vía Resend a admin@fiza.mx
--     (saturar la bandeja + quemar cuota/costo de Resend).
--   • POST /api/track — inserta en analytics_events con service-role. El
--     `event` está en allowlist pero no hay límite de frecuencia: un bot puede
--     inflar la tabla y contaminar TODOS los KPIs del dashboard de founders.
--
-- Por qué una tabla nueva en vez de reusar `rate_limits`: esa tabla tiene
-- `user_id` con FK a auth.users, así que no puede registrar tráfico anónimo.
-- (Efecto secundario útil de ese FK: ya impedía el bloat con UUIDs random.)
--
-- Acceso: la función es SECURITY DEFINER pero se revoca de PUBLIC y se otorga
-- SOLO a service_role. Así no repetimos el problema de `check_rate_limit`, que
-- al ser invocable por clientes permitía envenenar el contador de otros
-- (ver migración 030). Acá ningún cliente puede llamarla; solo el server.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  ip           TEXT        NOT NULL,
  bucket       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, bucket, window_start)
);

-- RLS habilitado y CERO policies = deny-all para anon/authenticated.
-- Mismo patrón deliberado que `rate_limits` y `stripe_events`: tabla
-- server-only, accesible solo por service_role y SECURITY DEFINER.
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ip_rate_limits_cleanup_idx
  ON public.ip_rate_limits (window_start);

-- ------------------------------------------------------------
-- Incremento atómico del contador de la ventana actual.
-- Devuelve TRUE si la request cabe dentro del límite.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  p_ip             text,
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
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch from NOW()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.ip_rate_limits (ip, bucket, window_start, count)
  VALUES (left(p_ip, 64), p_bucket, v_window_start, 1)
  ON CONFLICT (ip, bucket, window_start)
    DO UPDATE SET count = public.ip_rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) TO service_role;

-- ------------------------------------------------------------
-- Limpieza de ventanas viejas.
--
-- Nota: `rate_limits` (la tabla de usuarios autenticados, migración 008) nunca
-- tuvo job de limpieza — crecía indefinidamente. Su índice
-- `rate_limits_cleanup_idx` existía justamente para esto pero el advisor lo
-- reportaba como "unused index" porque nadie lo usaba. Se aprovecha para
-- limpiar las dos tablas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_windows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  DELETE FROM public.ip_rate_limits WHERE window_start < NOW() - INTERVAL '2 days';
  DELETE FROM public.rate_limits    WHERE window_start < NOW() - INTERVAL '2 days';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_windows() FROM PUBLIC;
