-- ============================================================
-- fiza v0.4 — Columnas de preferencias en perfil
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moneda_preferida    TEXT    DEFAULT 'MXN'   CHECK (moneda_preferida IN ('MXN', 'USD')),
  ADD COLUMN IF NOT EXISTS mostrar_inversiones BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mostrar_pendientes  BOOLEAN DEFAULT TRUE;
