-- ============================================================
-- 021_recurring_safety_net.sql
--
-- pg_cron safety net para recurrentes.
--
-- Hoy la materialización del siguiente pendiente es 100% event-driven:
--   - POST /api/recurring → primer pendiente
--   - PATCH /api/recurring/[id] al reanudar → próximo si no hay vivo
--   - PATCH /api/movements/[id] al pagar uno con recurring_movement_id
--     → siguiente
--
-- Si por algún bug ese evento falla en silencio (timeout de Vercel,
-- error de red, etc.), el recurrente queda atascado: el user nunca verá
-- su próxima renta porque nadie disparó la materialización.
--
-- Esta migración agrega un cron diario que itera los recurrentes
-- activos con `next_due_date <= today (CDMX)` y les llama una versión
-- en PL/pgSQL del helper `materializeNextPending` (lib/recurring/materialize.ts).
-- El helper es **idempotente**: si ya hay un pendiente vivo, no hace nada.
-- Por lo tanto el cron es no-op cuando todo funciona; solo actúa como red.
--
-- Importante: la fuente de verdad sigue siendo el flow JS event-driven.
-- Este cron es belt-and-suspenders, no el motor del feature.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. advance_recurring_date(date, frequency) → date
--
-- Réplica del `advanceDate` de lib/recurring/materialize.ts. Maneja los
-- mismos edge cases:
--   - month con día 31 → cap al último día del mes destino
--   - year con 29-feb → cap a 28-feb del año destino no bisiesto
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.advance_recurring_date(
  p_date date,
  p_frequency text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_target_y    int;
  v_target_m    int;
  v_orig_d      int := EXTRACT(DAY FROM p_date)::int;
  v_last_day    int;
BEGIN
  CASE p_frequency
    WHEN 'week' THEN
      RETURN p_date + INTERVAL '7 days';

    WHEN 'month' THEN
      v_target_y := EXTRACT(YEAR  FROM p_date)::int;
      v_target_m := EXTRACT(MONTH FROM p_date)::int + 1;
      IF v_target_m > 12 THEN
        v_target_m := 1;
        v_target_y := v_target_y + 1;
      END IF;
      -- último día del mes destino
      v_last_day := EXTRACT(DAY FROM
        (make_date(v_target_y, v_target_m, 1) + INTERVAL '1 month - 1 day')::date
      )::int;
      RETURN make_date(v_target_y, v_target_m, LEAST(v_orig_d, v_last_day));

    WHEN 'year' THEN
      v_target_y := EXTRACT(YEAR  FROM p_date)::int + 1;
      v_target_m := EXTRACT(MONTH FROM p_date)::int;
      v_last_day := EXTRACT(DAY FROM
        (make_date(v_target_y, v_target_m, 1) + INTERVAL '1 month - 1 day')::date
      )::int;
      RETURN make_date(v_target_y, v_target_m, LEAST(v_orig_d, v_last_day));

    ELSE
      RAISE EXCEPTION 'Invalid frequency: %', p_frequency;
  END CASE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. materialize_next_pending(recurring_id) → uuid del nuevo movement, o NULL
--
-- Réplica PL/pgSQL del helper TS. Idempotente: si ya existe un pendiente
-- vivo (type='pendiente') vinculado a este recurring, devuelve NULL sin tocar.
-- Si el recurrente está pausado (is_active=false), devuelve NULL.
--
-- SECURITY DEFINER porque corre desde el cron (sin sesión auth) y debe
-- bypasar RLS para insertar a nombre del owner del recurrente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.materialize_next_pending(p_recurring_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rec       public.recurring_movements%ROWTYPE;
  v_existing  uuid;
  v_entry_id  uuid;
  v_mov_id    uuid;
  v_next      date;
BEGIN
  -- 1. Lee el template
  SELECT * INTO v_rec
    FROM public.recurring_movements
   WHERE id = p_recurring_id;

  IF NOT FOUND OR NOT v_rec.is_active THEN
    RETURN NULL;
  END IF;

  -- 2. Idempotencia: ¿hay un pendiente vivo para este recurring?
  SELECT id INTO v_existing
    FROM public.movements
   WHERE recurring_movement_id = p_recurring_id
     AND type = 'pendiente'
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Insert entry sintético
  INSERT INTO public.entries (user_id, raw_text, input_source, entry_date)
  VALUES (
    v_rec.user_id,
    'Recurrente: ' || v_rec.description,
    'recurring',
    v_rec.next_due_date
  )
  RETURNING id INTO v_entry_id;

  -- 4. Insert pendiente
  INSERT INTO public.movements (
    entry_id, user_id, type, amount, description, category,
    movement_date, is_investment, pending_direction,
    recurring_movement_id, original_type
  ) VALUES (
    v_entry_id, v_rec.user_id, 'pendiente', v_rec.amount, v_rec.description,
    v_rec.category, v_rec.next_due_date, FALSE, v_rec.type,
    v_rec.id, 'pendiente'
  )
  RETURNING id INTO v_mov_id;

  -- 5. Avanza next_due_date + last_materialized_at
  v_next := public.advance_recurring_date(v_rec.next_due_date, v_rec.frequency);
  UPDATE public.recurring_movements
     SET next_due_date        = v_next,
         last_materialized_at = NOW()
   WHERE id = p_recurring_id;

  -- 6. Audit event
  INSERT INTO public.movement_events (movement_id, user_id, event_type, payload)
  VALUES (
    v_mov_id, v_rec.user_id, 'recurring_materialized',
    jsonb_build_object(
      'recurring_movement_id', v_rec.id,
      'frequency',             v_rec.frequency,
      'next_due_date',         v_next,
      'source',                'cron_safety_net'
    )
  );

  RETURN v_mov_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. materialize_overdue_recurrings() → int (cuántos materializó)
--
-- Itera recurrentes activos cuyo next_due_date ya llegó (o pasó) y llama
-- al helper. "Hoy" en CDMX, mismo patrón que migration 017 (count_daily_movements).
-- Maneja cada recurrente en su propia sub-transacción para que un fallo
-- (ej. trigger de límite Free) no aborte el batch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.materialize_overdue_recurrings()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_today_cdmx date := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
  v_rec_id     uuid;
  v_result     uuid;
  v_count      int  := 0;
BEGIN
  FOR v_rec_id IN
    SELECT id FROM public.recurring_movements
     WHERE is_active = TRUE
       AND next_due_date <= v_today_cdmx
  LOOP
    BEGIN
      v_result := public.materialize_next_pending(v_rec_id);
      IF v_result IS NOT NULL THEN
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Un fallo (ej. enforce_free_plan_limit_trigger si el user free ya
      -- hizo 10 movs hoy) no debe abortar el batch. Loguea y sigue.
      RAISE WARNING 'materialize_overdue_recurrings: recurring_id=% failed: %',
        v_rec_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Schedule diario
--
-- 06:00 UTC ≈ 00:00 CDMX estándar. No corremos cada hora porque el helper
-- event-driven cubre el happy path; este cron solo es red de seguridad.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('materialize-overdue-recurrings')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'materialize-overdue-recurrings'
);

SELECT cron.schedule(
  'materialize-overdue-recurrings',
  '0 6 * * *',
  $$SELECT public.materialize_overdue_recurrings();$$
);
