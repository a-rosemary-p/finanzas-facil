-- ============================================================
-- 017_cdmx_timezone_for_daily_counters.sql
--
-- Bug: el contador `movements_today` se reseteaba a las 00:00 UTC
-- (= 18:00 CDMX en horario de invierno, 17:00 en verano) en vez de
-- a la medianoche local de CDMX. Tres funciones usaban CURRENT_DATE
-- (que es UTC en Supabase):
--
--   1. count_daily_movements()        — AFTER INSERT en movements
--   2. enforce_free_plan_limit()      — BEFORE INSERT en movements
--   3. reset_daily_movement_counters()— cron job hourly
--
-- Fix: reemplazar CURRENT_DATE por (NOW() AT TIME ZONE
-- 'America/Mexico_City')::date. El cron sigue corriendo cada hora
-- (idempotente), pero ahora el "hoy" que escribe es CDMX-correcto.
--
-- Nota: hardcodeamos 'America/Mexico_City'. Si en algún futuro la
-- mayoría de usuarios queda en otra TZ (Tijuana, etc.), evaluar leer
-- profiles.timezone por usuario. Hoy 100% de los usuarios están en
-- horario CDMX o cerca, así que un solo offset es suficiente y simple.
-- ============================================================

-- 1. AFTER INSERT trigger
CREATE OR REPLACE FUNCTION public.count_daily_movements()
RETURNS TRIGGER AS $$
DECLARE
  cdmx_today date := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF (SELECT movements_today_date FROM public.profiles WHERE id = NEW.user_id) < cdmx_today THEN
    -- Nuevo día CDMX: reset y count = 1
    UPDATE public.profiles
    SET movements_today = 1, movements_today_date = cdmx_today
    WHERE id = NEW.user_id;
  ELSE
    -- Mismo día: incrementar
    UPDATE public.profiles
    SET movements_today = movements_today + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. BEFORE INSERT trigger (free plan enforcement)
CREATE OR REPLACE FUNCTION public.enforce_free_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan         TEXT;
  v_today        INTEGER;
  v_today_date   DATE;
  v_limit        CONSTANT INTEGER := 10;
  v_cdmx_today   DATE := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  SELECT plan, movements_today, movements_today_date
    INTO v_plan, v_today, v_today_date
    FROM public.profiles
   WHERE id = NEW.user_id
   FOR UPDATE;

  IF NOT FOUND OR v_plan <> 'free' THEN
    RETURN NEW;
  END IF;

  -- Compara contra HOY-CDMX. Si v_today_date es de un día CDMX anterior,
  -- el contador se considera 0 (el AFTER trigger lo reseteará en este INSERT).
  IF v_today_date = v_cdmx_today AND v_today >= v_limit THEN
    RAISE EXCEPTION 'free_plan_limit_exceeded'
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade a Pro para movimientos ilimitados';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 3. Cron de reset (corre cada hora — idempotente)
CREATE OR REPLACE FUNCTION public.reset_daily_movement_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cdmx_today date := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  UPDATE public.profiles
  SET
    movements_today      = 0,
    movements_today_date = cdmx_today
  WHERE movements_today_date < cdmx_today
    AND movements_today > 0;
END;
$$;
