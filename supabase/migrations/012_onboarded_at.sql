-- ============================================================
-- 012_onboarded_at.sql
--
-- Flag para que el onboarding solo aparezca una vez por cuenta. Antes
-- pensamos usar `total_movements === 0` como heurística, pero un user que
-- pasó por el tour, registró movs, y después borró todo no quiere ver el
-- tour de nuevo. Flag explícito.
--
-- Set vía POST /api/onboarding/complete cuando el user termina o salta
-- el tour. NULL hasta entonces.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Column-level GRANT: el user puede setear su propio onboarded_at vía la
-- API route que vamos a crear (que corre con el JWT del user, no con
-- service_role). Sin este GRANT el UPDATE falla silenciosamente porque
-- migration 007 limita las columnas updateable.
GRANT UPDATE (onboarded_at) ON public.profiles TO authenticated;
