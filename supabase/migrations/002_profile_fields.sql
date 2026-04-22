-- ============================================================
-- fiza v0.3 — Campos de perfil + contador histórico
-- ============================================================

-- Nuevas columnas en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS giro     TEXT,
  ADD COLUMN IF NOT EXISTS ciudad   TEXT,
  ADD COLUMN IF NOT EXISTS estado   TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS total_movements INTEGER DEFAULT 0;

-- Ampliar CHECK de subscription_status para incluir estados de trial
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN (
    'none', 'active', 'trialing', 'past_due',
    'canceled', 'unpaid', 'incomplete_expired'
  ));

-- Backfill: poblar total_movements con movimientos históricos existentes
UPDATE public.profiles p
SET total_movements = (
  SELECT COUNT(*) FROM public.movements m WHERE m.user_id = p.id
);

-- ============================================================
-- TRIGGER: Mantener total_movements en INSERT y DELETE
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_total_movements()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET total_movements = total_movements + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET total_movements = GREATEST(total_movements - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_movement_total_change
  AFTER INSERT OR DELETE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.update_total_movements();
