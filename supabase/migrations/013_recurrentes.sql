-- ============================================================
-- 013_recurrentes.sql
--
-- Sprint 3: feature de recurrentes con semántica "solo el próximo pendiente
-- está materializado a la vez". Al pagar el pendiente, el siguiente se
-- materializa automáticamente.
--
-- Cambios en `movements`:
-- 1. `pending_direction` — para pendientes que ya saben en qué se van a
--    convertir cuando se paguen. Permite "me van a pagar 5000 el domingo"
--    como pendiente de dirección 'ingreso'. Null = back-compat (default
--    gasto al pagar).
-- 2. `recurring_movement_id` — link al recurrente que generó este pendiente.
--    Cuando este pendiente se marca pagado, ese link nos dice qué recurrente
--    avanzar. ON DELETE SET NULL para que borrar un recurrente no borre
--    el pendiente activo (queda huérfano pero sigue existiendo).
--
-- NO usamos pg_cron — la materialización es event-driven (cuando pagas el
-- actual, JS-side crea el siguiente). Más simple y reactivo.
-- ============================================================

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS pending_direction TEXT NULL
    CHECK (pending_direction IS NULL OR pending_direction IN ('ingreso', 'gasto')),
  ADD COLUMN IF NOT EXISTS recurring_movement_id UUID NULL
    REFERENCES public.recurring_movements(id) ON DELETE SET NULL;

-- Index para encontrar el pendiente activo de un recurrente (usado al pagar).
CREATE INDEX IF NOT EXISTS idx_movements_recurring
  ON public.movements(recurring_movement_id)
  WHERE recurring_movement_id IS NOT NULL;

COMMENT ON COLUMN public.movements.pending_direction IS
  'Dirección de un pendiente: en qué tipo se convierte al ser pagado. ingreso = pendiente de cobro; gasto = pendiente de pago. NULL = back-compat (asume gasto).';
COMMENT ON COLUMN public.movements.recurring_movement_id IS
  'Si este movimiento fue generado por un recurrente, apunta a su template. Al pagar este pendiente se dispara la materialización del siguiente.';
