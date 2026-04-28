-- ============================================================
-- 010_pendientes_recurrentes.sql
--
-- Setup para la página /pendientes + audit trail + skeleton de recurrentes.
--
-- 1. movements: agregar paid_at + original_type para preservar señal cuando
--    un pendiente se convierte en gasto via "Pagado".
-- 2. movement_events: tabla nueva para audit trail. Eventos con payload jsonb
--    flexible. ON DELETE CASCADE — si el movimiento se borra, sus eventos
--    también (suficiente para v1; si queremos preservar audit aún tras
--    delete, agregar soft-delete en una migración futura).
-- 3. recurring_movements: skeleton para el feature de recurrentes (Sprint 3).
--    Soporta 'week' / 'month' / 'year'. El cron de materialización viene en
--    una migración posterior junto con el resto del feature.
--
-- ============================================================

-- 1. movements: paid_at + original_type ─────────────────────────────────────
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_type TEXT;

COMMENT ON COLUMN public.movements.paid_at IS
  'Cuando un pendiente fue pagado. Solo se setea en el PATCH que cambia type=pendiente→gasto.';
COMMENT ON COLUMN public.movements.original_type IS
  'Tipo original al crear el movimiento. Útil para distinguir "este gasto fue pendiente que pagué" vs "gasto registrado directo".';


-- 2. movement_events: audit trail ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: si se borra el movimiento, los eventos también.
  movement_id UUID REFERENCES public.movements(id) ON DELETE CASCADE NOT NULL,
  -- user_id denormalizado para RLS sin necesidad de join, e índice por user.
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'paid', 'edited')),
  -- payload flexible para captar datos del evento sin migrar schema cada vez.
  -- Ej: { "prev_type": "pendiente", "new_type": "gasto", "prev_movement_date": "2026-04-30", "new_movement_date": "2026-04-27" }
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_events_movement
  ON public.movement_events(movement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movement_events_user
  ON public.movement_events(user_id, created_at DESC);

ALTER TABLE public.movement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movement_events_select_own"
  ON public.movement_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "movement_events_insert_own"
  ON public.movement_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE — los eventos son inmutables (audit trail).
REVOKE UPDATE, DELETE ON public.movement_events FROM authenticated, anon;


-- 3. recurring_movements: templates que generan pendientes ─────────────────
CREATE TABLE IF NOT EXISTS public.recurring_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Datos del movimiento que se va a materializar cada periodo.
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL,  -- TEXT libre (igual que movements.category, sin CHECK)

  -- Frecuencia + cuándo se materializa el siguiente.
  frequency TEXT NOT NULL CHECK (frequency IN ('week', 'month', 'year')),
  next_due_date DATE NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadatos.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_movements_user
  ON public.recurring_movements(user_id, is_active);
-- Para el cron diario: encuentra todos los activos cuyo next_due_date llegó.
CREATE INDEX IF NOT EXISTS idx_recurring_movements_due
  ON public.recurring_movements(next_due_date) WHERE is_active = TRUE;

ALTER TABLE public.recurring_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_movements_select_own"
  ON public.recurring_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recurring_movements_insert_own"
  ON public.recurring_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_movements_update_own"
  ON public.recurring_movements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_movements_delete_own"
  ON public.recurring_movements FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.recurring_movements IS
  'Templates que generan pendientes cada periodo. La materialización (crear un movement type=pendiente desde el template y avanzar next_due_date) se ejecuta vía pg_cron diario — esa función + schedule viven en una migración posterior junto con el resto del feature de recurrentes.';
