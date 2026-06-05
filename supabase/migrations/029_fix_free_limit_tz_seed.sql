-- ============================================================
-- 029_fix_free_limit_tz_seed.sql
--
-- Bug (encontrado en testing, 5 jun 2026 — usuario Robert llegó a 20/10
-- movimientos siendo plan Free):
--
-- Causa raíz: TIMEZONE SEED MISMATCH.
--   `profiles.movements_today_date` tiene DEFAULT CURRENT_DATE, que en
--   Supabase es UTC. Cuando un usuario Free crea su cuenta en la tarde-noche
--   CDMX (después de ~18:00, cuando UTC ya rodó al día siguiente), el counter
--   queda seedeado con la fecha de MAÑANA en términos CDMX.
--
--   Ejemplo real: Robert creó cuenta 2026-06-04 02:57 UTC = 2026-06-03 20:57
--   CDMX. El default seedeó movements_today_date = 2026-06-04 (UTC), pero el
--   "hoy CDMX" era 2026-06-03.
--
-- Efecto en cascada — las dos funciones comparan contra CDMX hoy:
--   1. enforce_free_plan_limit (BEFORE INSERT): solo bloqueaba si
--      `v_today_date = v_cdmx_today`. Como la fecha estaba en el futuro
--      (June 4 ≠ June 3), NUNCA coincidía → NUNCA bloqueaba.
--   2. count_daily_movements (AFTER INSERT): solo reseteaba si
--      `stored_date < cdmx_today`. Como June 4 NO es < June 3, caía en el
--      ELSE → incrementaba sin fin. La fecha futura nunca se normalizaba.
--
--   Resultado: el límite Free quedaba deshabilitado desde el signup nocturno
--   hasta que CDMX alcanzaba la fecha seedeada (medianoche CDMX siguiente).
--   El usuario podía meter movimientos ilimitados gratis en esa ventana.
--
-- Fix (tres capas, defensa en profundidad):
--   A. Cambiar el DEFAULT de la columna a fecha CDMX → nuevos signups ya no
--      seedean en el futuro.
--   B. count_daily_movements: usar `<>` en vez de `<` → cualquier fecha que
--      difiera de hoy-CDMX (pasada O futura) resetea el counter a 1 y
--      normaliza la fecha. Auto-sana filas con fecha futura en el primer
--      insert siguiente.
--   C. enforce_free_plan_limit: usar `>=` en vez de `=` → bloquea aunque la
--      fecha esté en el futuro (caso defensivo; con (B) la fecha se normaliza
--      de todos modos, pero esto cierra cualquier ventana residual).
--   D. Limpieza one-time: resetear filas que tengan fecha en el futuro AHORA.
--
-- Nota: igual que migration 017, hardcodeamos 'America/Mexico_City'. Si en el
-- futuro hay usuarios mayoritariamente en otra TZ, evaluar leer
-- profiles.timezone por usuario.
-- ============================================================

-- A. DEFAULT de la columna → fecha CDMX (no UTC).
ALTER TABLE public.profiles
  ALTER COLUMN movements_today_date
  SET DEFAULT (NOW() AT TIME ZONE 'America/Mexico_City')::date;

-- B. AFTER INSERT trigger: resetear cuando la fecha DIFIERE de hoy-CDMX
--    (antes solo si era estrictamente anterior con `<`).
CREATE OR REPLACE FUNCTION public.count_daily_movements()
RETURNS TRIGGER AS $$
DECLARE
  cdmx_today date := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  -- `<>` en vez de `<`: una fecha futura (seedeada por el bug de TZ) también
  -- se considera "otro día" → resetea y normaliza a hoy-CDMX. Esto auto-sana
  -- cualquier counter que haya quedado con fecha adelantada.
  IF (SELECT movements_today_date FROM public.profiles WHERE id = NEW.user_id) <> cdmx_today THEN
    UPDATE public.profiles
    SET movements_today = 1, movements_today_date = cdmx_today
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET movements_today = movements_today + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- C. BEFORE INSERT trigger (free enforcement): bloquear si la fecha es hoy-CDMX
--    O posterior (>=), no solo igual (=). Defensa contra fechas futuras
--    residuales.
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

  -- `>=`: si la fecha del counter es hoy-CDMX o futura, y ya alcanzó el
  -- límite, bloquear. (El AFTER trigger normaliza fechas futuras a hoy, así
  -- que en flujo normal esto equivale a `=`; el `>=` cubre el edge residual.)
  IF v_today_date >= v_cdmx_today AND v_today >= v_limit THEN
    RAISE EXCEPTION 'free_plan_limit_exceeded'
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade a Pro para movimientos ilimitados';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- D. Limpieza one-time: normalizar filas con fecha en el futuro. Reseteamos a
--    0 (límite fresco) y fecha = hoy-CDMX. Conservador y generoso con el user.
UPDATE public.profiles
SET
  movements_today      = 0,
  movements_today_date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
WHERE movements_today_date > (NOW() AT TIME ZONE 'America/Mexico_City')::date;
