-- ============================================================
-- fiza v0.22 — Cron: reset movements_today a medianoche
-- ============================================================
-- Ejecuta cada hora y limpia filas cuyo movements_today_date
-- sea anterior a hoy. Al correr cada hora (no solo a medianoche)
-- cubrimos cualquier zona horaria MX sin depender de DST.
-- El UPDATE es idempotente y toca solo filas con counter sucio.
-- ============================================================

-- 1. Habilitar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función de reset
CREATE OR REPLACE FUNCTION public.reset_daily_movement_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    movements_today      = 0,
    movements_today_date = CURRENT_DATE
  WHERE movements_today_date < CURRENT_DATE
    AND movements_today > 0;
END;
$$;

-- 3. Eliminar job anterior si existía (idempotente)
SELECT cron.unschedule('reset-movements-today')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-movements-today'
);

-- 4. Programar: cada hora en punto
--    A las 06:00 UTC = medianoche CST (Ciudad de México estándar)
--    Correr cada hora garantiza reset sin importar DST
SELECT cron.schedule(
  'reset-movements-today',
  '0 * * * *',
  $$SELECT public.reset_daily_movement_counters();$$
);
