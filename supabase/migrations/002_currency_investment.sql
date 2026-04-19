-- ============================================================
-- FinanzasFácil v0.3 — Conversión de moneda + Tipo inversión
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- Columnas de conversión de moneda
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC DEFAULT 1;

-- Rellenar columnas para filas existentes
UPDATE public.movements
  SET original_amount = amount,
      original_currency = 'MXN',
      exchange_rate_used = 1
  WHERE original_amount IS NULL;

-- Columna de inversión
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS is_investment BOOLEAN DEFAULT FALSE;
