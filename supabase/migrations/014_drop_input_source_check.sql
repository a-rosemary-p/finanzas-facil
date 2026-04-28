-- ============================================================
-- 014_drop_input_source_check.sql
--
-- Bug encontrado durante el e2e test de Sprint 3:
-- `entries.input_source` tenía CHECK con solo ('text','voice','photo') de
-- migration 001. Sprint 3 introdujo 'recurring' como cuarto valor (entries
-- sintéticos generados por materializeNextPending). El CHECK rechazaba el
-- INSERT y por lo tanto crear cualquier recurrente fallaba.
--
-- Schema review v0.27 sección 2.1 ya había flagged esto como riesgo —
-- ahora se hace concreto. Aplicamos la misma estrategia que con category
-- (migration 009): drop el CHECK, validación 100% en código.
-- ============================================================

ALTER TABLE public.entries
  DROP CONSTRAINT IF EXISTS entries_input_source_check;
