-- ============================================================
-- fiza v0.22 — Anti-abuse: columna trial_used
-- ============================================================
-- Impide que un usuario cree cuenta nueva, active el trial,
-- cancele y repita indefinidamente. Una vez que se usa el trial,
-- esta columna queda en TRUE y el checkout omite trial_period_days.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.trial_used IS
  'TRUE si el usuario ya activó un trial de Stripe alguna vez. Se marca en checkout.session.completed.';
