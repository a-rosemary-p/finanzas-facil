-- ============================================================
-- 011_polish_audit.sql
--
-- Items "aplicar ya" del schema review (ver
-- Fiza_SCHEMA_REVIEW v0.27 270426.md):
--
-- 1. movements.amount > 0 CHECK (defensa en profundidad)
-- 2. movements.original_type valida dominio
-- 3. movements.updated_at + trigger automático
-- 4. movement_events: drop CHECK de event_type (mismo razonamiento que el
--    drop de category — el dominio crece, mejor validar en código)
-- 5. recurring_movements.last_materialized_at (debugging + idempotencia
--    belt-and-suspenders para Sprint 3)
-- ============================================================

-- 1. amount > 0
ALTER TABLE public.movements
  ADD CONSTRAINT movements_amount_positive CHECK (amount > 0);

-- 2. original_type valido si está presente
ALTER TABLE public.movements
  ADD CONSTRAINT movements_original_type_valid
    CHECK (original_type IS NULL OR original_type IN ('ingreso','gasto','pendiente'));

-- 3. updated_at con trigger
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movements_touch_updated_at ON public.movements;
CREATE TRIGGER trg_movements_touch_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. drop CHECK de event_type — abre espacio a 'recurring_materialized',
-- 'deleted', etc. sin nueva migración cada vez.
ALTER TABLE public.movement_events
  DROP CONSTRAINT IF EXISTS movement_events_event_type_check;

-- 5. recurring_movements.last_materialized_at
ALTER TABLE public.recurring_movements
  ADD COLUMN IF NOT EXISTS last_materialized_at TIMESTAMPTZ;
