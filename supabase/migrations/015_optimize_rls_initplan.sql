-- ============================================================
-- 015_optimize_rls_initplan.sql
--
-- Performance fix detectado por el e2e test de Sprint 3:
-- Las RLS policies que creé en migration 010 usan `auth.uid() = user_id`
-- directo. Postgres re-evalúa `auth.uid()` por CADA fila escaneada en lugar
-- de cachearlo una vez por query. A escala genera 100x más overhead.
--
-- Patrón canónico: `(SELECT auth.uid())` — el subquery hace que Postgres
-- evalúe la función UNA SOLA VEZ y cache el resultado. Ver
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Solo arreglo las policies que YO creé (sprints 1a-3). Las pre-existentes
-- (entries.own_data, movements.own_data, profiles_*) tienen el mismo problema
-- pero arreglarlas requiere recrearlas y son más sensibles — issue separado.
-- ============================================================

-- movement_events
DROP POLICY IF EXISTS movement_events_select_own ON public.movement_events;
CREATE POLICY movement_events_select_own
  ON public.movement_events FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS movement_events_insert_own ON public.movement_events;
CREATE POLICY movement_events_insert_own
  ON public.movement_events FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- recurring_movements
DROP POLICY IF EXISTS recurring_movements_select_own ON public.recurring_movements;
CREATE POLICY recurring_movements_select_own
  ON public.recurring_movements FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS recurring_movements_insert_own ON public.recurring_movements;
CREATE POLICY recurring_movements_insert_own
  ON public.recurring_movements FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS recurring_movements_update_own ON public.recurring_movements;
CREATE POLICY recurring_movements_update_own
  ON public.recurring_movements FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS recurring_movements_delete_own ON public.recurring_movements;
CREATE POLICY recurring_movements_delete_own
  ON public.recurring_movements FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
