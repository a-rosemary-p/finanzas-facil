-- ============================================================
-- 020_optimize_rls_initplan_legacy.sql
--
-- Continuación de migration 015. Aquí completamos la optimización del
-- patrón RLS canónico de Supabase (subquery cacheado) para las policies
-- pre-existentes que se quedaron con `auth.uid() = user_id` directo:
--
--   - entries.own_data
--   - movements.own_data
--   - profiles_select_own
--   - profiles_update_own
--
-- Patrón canónico: `(SELECT auth.uid())` se evalúa UNA SOLA VEZ por query
-- en lugar de re-evaluarse por fila escaneada. A escala el speedup es
-- significativo. Ver:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Las policies se recrean idénticas excepto por el subquery. No cambia
-- el modelo de seguridad — solo el plan de ejecución.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENTRIES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_data" ON public.entries;
CREATE POLICY "own_data"
  ON public.entries
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MOVEMENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_data" ON public.movements;
CREATE POLICY "own_data"
  ON public.movements
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES — split SELECT/UPDATE de migration 007 (sin cambios de modelo)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
