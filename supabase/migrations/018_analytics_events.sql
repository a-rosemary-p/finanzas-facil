-- ============================================================
-- 018_analytics_events.sql
--
-- Tabla genérica de eventos de producto para entender uso real:
--   - quién/cuántos exportan reportes (PDF / Excel)
--   - método de captura preferido (text/voice/photo) — esto ya está
--     en `entries.input_source` y `movement_events.payload`, pero
--     unificamos métricas de uso aquí
--   - completion de onboarding
--   - creación de recurrentes (señal fuerte de retention)
--   - pagos de pendientes (engagement con feature)
--   - intentos de exceder límite Free (señal de demanda Pro)
--
-- Schema deliberadamente simple: nombre del evento + payload jsonb.
-- Si algo crece a volumen alto, lo movemos a su tabla dedicada.
--
-- RLS:
--   INSERT: usuario autenticado solo puede insertar con su propio user_id.
--   SELECT: ninguna policy → solo service_role lee (queries en Studio).
--   user_id ON DELETE SET NULL: si un usuario se borra, los eventos
--   quedan anonimizados pero no se pierden (útil para métricas agregadas).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queries típicas:
--   "cuántos report_exported en los últimos 30 días" → filtro por event_name + created_at
--   "qué hizo el user X últimamente" → filtro por user_id + created_at
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON public.analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON public.analytics_events(user_id, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del evento puede insertarlo.
DROP POLICY IF EXISTS analytics_events_insert_own ON public.analytics_events;
CREATE POLICY analytics_events_insert_own ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Sin policy de SELECT → la app no consulta esta tabla; solo se lee con
-- service_role (admin queries en Supabase Studio o jobs de reporting).
