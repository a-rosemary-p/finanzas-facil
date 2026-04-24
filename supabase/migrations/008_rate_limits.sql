-- 008_rate_limits.sql
-- Rate limiting por usuario para endpoints que llaman a OpenAI (costo $$).
-- El límite Free de 10 movs/día ya acota Free; esto protege contra abuso en Pro,
-- donde el plan es "ilimitado" pero OpenAI sí cobra por cada llamada.
--
-- Diseño: una fila por (user_id, bucket, window_start). `bucket` identifica
-- el endpoint ('entry' / 'entry_photo'). `window_start` es el inicio del
-- período (redondeado a la hora, p.ej. 2026-04-24T15:00:00Z). `count` se
-- incrementa con INSERT ... ON CONFLICT DO UPDATE.
--
-- La función `check_rate_limit` hace atómico el "incrementa y checa":
--   - Si cabe bajo el límite, incrementa y devuelve TRUE
--   - Si ya está al tope, NO incrementa y devuelve FALSE

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket         TEXT NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL,
  count          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_cleanup_idx
  ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sin policies → solo service_role (que bypasea RLS). Los API handlers corren
-- server-side con el supabase client del request, pero como RLS está cerrada,
-- la función debe ser SECURITY DEFINER para hacer el increment.

-- check_rate_limit: devuelve TRUE si la request está permitida.
-- Parámetros:
--   p_user_id    — auth.uid() del cliente
--   p_bucket     — nombre del endpoint/grupo ('entry', 'entry_photo', etc.)
--   p_limit      — max requests en la ventana
--   p_window_seconds — tamaño de la ventana en segundos (ej. 3600 = 1 hr)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id         UUID,
  p_bucket          TEXT,
  p_limit           INTEGER,
  p_window_seconds  INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start  TIMESTAMPTZ;
  v_count         INTEGER;
BEGIN
  -- Redondea `now()` al inicio de la ventana actual. Todas las requests de
  -- ese user+bucket en esa ventana comparten la misma fila.
  v_window_start := to_timestamp(
    floor(extract(epoch from NOW()) / p_window_seconds) * p_window_seconds
  );

  -- INSERT optimista con ON CONFLICT DO UPDATE para incrementar atómicamente.
  -- RETURNING regresa el count post-incremento.
  INSERT INTO public.rate_limits (user_id, bucket, window_start, count)
  VALUES (p_user_id, p_bucket, v_window_start, 1)
  ON CONFLICT (user_id, bucket, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Si después del incremento excede, devolvemos false (pero la fila ya se
  -- incrementó; así el límite "late one" no permite una request extra).
  -- Consideramos OK hasta exactamente el límite.
  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Cleanup opcional: las filas viejas se pueden barrer con un cron. Por ahora
-- las dejamos — son chicas y no afectan performance en volúmenes bajos.
-- Si el volumen crece, agregar un pg_cron que borre window_start < NOW() - INTERVAL '7 days'.

COMMENT ON TABLE public.rate_limits IS
  'Rate limits por user+bucket+ventana. La función check_rate_limit hace el increment atómico.';
