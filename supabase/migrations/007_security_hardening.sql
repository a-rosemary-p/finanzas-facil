-- 007_security_hardening.sql
-- Aborda hallazgos críticos y altos de los security audits:
--   • profiles RLS: separar SELECT/UPDATE, agregar WITH CHECK, revocar INSERT/DELETE,
--     y column-level GRANT para impedir self-promote a Pro y hijack de stripe_customer_id.
--   • movements: BEFORE INSERT trigger que hace cumplir el límite Free (10/día) con
--     SELECT ... FOR UPDATE sobre profiles, cerrando el TOCTOU en /api/entry/confirm.
--   • stripe_events: tabla de idempotencia para el webhook (anti-replay).
--   • search_path pinning en las 5 funciones SECURITY DEFINER (mitiga Supabase lint).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES RLS — separar operaciones y bloquear escritura cruda del cliente
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop la policy FOR ALL sin WITH CHECK
DROP POLICY IF EXISTS "own_data" ON public.profiles;

-- SELECT: cada usuario ve solo su fila
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- UPDATE: ambos lados deben cumplir (antes y después del update)
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Revocar escritura cruda: trigger on_auth_user_created hace el INSERT inicial
-- (usando SECURITY DEFINER, bypass de RLS). El webhook de Stripe usa service_role.
-- Nunca hay razón para que un usuario autenticado haga INSERT/DELETE directo.
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;

-- UPDATE column-level: solo permitimos los campos "perfil" y "settings".
-- Esto impide que un cliente haga UPDATE con plan='pro', trial_used=false, etc.
-- incluso si la policy UPDATE los dejara pasar.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  display_name,
  giro,
  ciudad,
  estado,
  timezone,
  moneda_preferida,
  mostrar_inversiones,
  mostrar_pendientes
) ON public.profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MOVEMENTS: enforcement server-side del límite Free (10/día)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hasta ahora el check vivía en 3 handlers HTTP (/api/entry, /entry/photo,
-- /entry/confirm). Cliente con el JWT puede insertar directo a `movements`
-- (RLS deja pasar por user_id) y saltarse esos handlers. Este trigger
-- enforça la regla en la base de datos con SELECT ... FOR UPDATE para cerrar
-- el TOCTOU entre varios INSERTs concurrentes.

CREATE OR REPLACE FUNCTION public.enforce_free_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan            TEXT;
  v_today           INTEGER;
  v_today_date      DATE;
  v_movement_date   DATE;
  v_limit           CONSTANT INTEGER := 10;
BEGIN
  -- Lockear la fila del usuario para evitar carreras concurrentes
  SELECT plan, movements_today, movements_today_date
    INTO v_plan, v_today, v_today_date
    FROM public.profiles
   WHERE id = NEW.user_id
   FOR UPDATE;

  -- Si no existe el perfil por alguna razón, dejamos pasar (RLS lo detiene
  -- antes, pero por defensa, no bloqueamos a un admin legítimo)
  IF NOT FOUND OR v_plan <> 'free' THEN
    RETURN NEW;
  END IF;

  -- Compara contra la FECHA del movimiento, no created_at. Si el día del
  -- contador no es hoy (CURRENT_DATE), el contador se considera 0 (se resetea
  -- en el AFTER INSERT trigger existente, count_daily_movements).
  v_movement_date := NEW.movement_date;

  IF v_today_date = CURRENT_DATE AND v_today >= v_limit THEN
    RAISE EXCEPTION 'free_plan_limit_exceeded'
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade a Pro para movimientos ilimitados';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS enforce_free_plan_limit_trigger ON public.movements;
CREATE TRIGGER enforce_free_plan_limit_trigger
  BEFORE INSERT ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_plan_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STRIPE EVENTS: idempotencia anti-replay
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo service_role lee/escribe esta tabla; ningún cliente
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No creamos policies → RLS cerrada total para anon/authenticated.
-- service_role bypasea RLS automáticamente.

COMMENT ON TABLE public.stripe_events IS
  'Idempotencia del webhook de Stripe. Insert con ON CONFLICT DO NOTHING; si no hubo inserción, es un replay y se ignora.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. search_path pinning en funciones SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Sin un search_path fijo, un atacante con permiso de CREATE en cualquier
-- schema del search_path puede shadowear objetos (public.profiles →
-- attacker_schema.profiles) y ejecutar código en el contexto del DEFINER.
-- Supabase advisor lo marca como WARN.

ALTER FUNCTION public.handle_new_user()                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.count_daily_movements()           SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_total_movements()          SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_email_to_profile()           SET search_path = pg_catalog, public;
ALTER FUNCTION public.reset_daily_movement_counters()   SET search_path = pg_catalog, public;
