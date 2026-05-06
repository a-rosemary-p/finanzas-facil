-- ============================================================
-- 019_profile_prompt.sql
--
-- Flag para el "profile prompt" — modal que sale UNA vez después de
-- que el user confirma su primer movimiento, pidiendo ciudad/estado/giro.
-- Independiente de `onboarded_at` (que es del tour pre-primer-mov).
--
-- NULL = todavía no se le mostró el prompt.
-- TIMESTAMPTZ = ya lo vio (haya llenado algo o no).
--
-- Set vía POST /api/onboarding/profile-prompt cuando el user envía o
-- cierra el modal. La policy RLS y el GRANT existentes permiten al user
-- updatear sus propios ciudad/estado/giro; aquí agregamos la nueva col.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_prompt_seen_at TIMESTAMPTZ;

-- Column-level GRANT — sin esto el UPDATE silenciosamente no toca la col
-- (migration 007 hizo whitelist de columnas updateable).
GRANT UPDATE (profile_prompt_seen_at) ON public.profiles TO authenticated;

-- Backfill: para users existentes que ya tienen al menos 1 movimiento al
-- momento del deploy, marcamos seen_at = NOW() para que no les salga el
-- prompt retroactivamente (la spec dice "la primera vez que el usuario
-- registra un movimiento" — si ya pasó esa primera vez, no es justo
-- prompter ahora). Los users con 0 movs sí lo verán cuando registren su
-- primero (que es el comportamiento esperado).
UPDATE public.profiles
   SET profile_prompt_seen_at = NOW()
 WHERE profile_prompt_seen_at IS NULL
   AND total_movements > 0;
