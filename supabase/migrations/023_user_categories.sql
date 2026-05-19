-- ============================================================
-- 023_user_categories.sql
--
-- Sistema de categorías per-user (v0.32):
--
-- Reemplaza el modelo viejo donde cada giro tenía un set hardcoded de
-- ~12 categorías específicas (GIRO_CATEGORIES en lib/constants.ts).
-- Nuevo modelo:
--   - Master list flat de 19 categorías genéricas (CATEGORIES_MASTER)
--   - Cada user tiene su lista curada (subset del master + custom strings
--     si son Pro), guardada en profiles.categories como text[]
--   - Pre-selección al onboarding según giro (GIRO_DEFAULTS)
--   - Pro puede agregar custom hasta 40 totales; Free solo curar del master
--
-- Existing users con `total_movements > 0` arrancan con categories_seen_at
-- NULL para que les salga un modal BLOQUEANTE en el próximo login que los
-- forza a curar la lista bajo el nuevo modelo (no queremos que arrastren
-- el sistema viejo). Users con 0 movs lo verán dentro del flow de
-- onboarding original.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS categories_seen_at TIMESTAMPTZ;

-- Column-level GRANT — sin esto el UPDATE silenciosamente no toca las cols
-- (migration 007 hizo whitelist de columnas updateable). El user setea su
-- propia lista vía POST /api/profile/categories.
GRANT UPDATE (categories, categories_seen_at) ON public.profiles TO authenticated;
