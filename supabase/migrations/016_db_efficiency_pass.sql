-- ============================================================
-- 016_db_efficiency_pass.sql
--
-- Pasada de eficiencia / redundancia v0.28. Solo cambios de bajo riesgo:
--
-- 1. Drop CHECK en `profiles.subscription_status`. Stripe puede agregar
--    estados nuevos ('paused', etc.) y el CHECK haría fallar el webhook
--    silencioso. Misma estrategia que aplicamos a `category`, `event_type`,
--    `input_source`. Validación application-side ya existe en types/index.ts.
--
-- 2. Index sobre `movements.entry_id`. FK sin covering index — flagged por
--    Supabase performance advisor. Útil para "todos los movs de esta entry"
--    (no hot path hoy, pero storage trivial y prepara queries futuras).
--
-- NO incluido (decisión consciente):
--  - Merge de AFTER INSERT triggers (count_daily_movements + update_total_
--    movements) — optimization real pero más invasivo. Documentado en
--    el siguiente DB review para considerar cuando volumen lo justifique.
--  - Drop de `entries.updated_at` (nunca se actualiza después del INSERT).
--    Cosmético, sin valor concreto.
-- ============================================================

-- 1. subscription_status sin CHECK
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

-- 2. Index para movements.entry_id
CREATE INDEX IF NOT EXISTS idx_movements_entry
  ON public.movements(entry_id);
