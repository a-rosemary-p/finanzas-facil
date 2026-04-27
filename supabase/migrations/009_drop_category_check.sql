-- ============================================================
-- 009_drop_category_check.sql
--
-- Tira el CHECK constraint sobre `movements.category` que limitaba la columna
-- a las 7 categorías viejas (Ventas / Ingredientes / Servicios / Transporte /
-- Renta / Servicios básicos / Otro).
--
-- Por qué:
--   - En abr 2026 el set se expandió a 15 activas + 2 legacy (rediseño con
--     enfoque a freelancers/emprendedores). El insert fallaba con
--     `movements_category_check` cuando el LLM clasificaba a "Honorarios",
--     "Insumos y materiales", etc.
--   - La validación ya vive application-side (lib/constants.ts CATEGORIES +
--     CATEGORIES_ALL, con fallback a 'Otro'). El CHECK era redundante y nos
--     forzaba a migrar la DB cada vez que el set cambiara.
--   - Los movimientos viejos con categorías legacy ('Ingredientes',
--     'Servicios') no se tocan — la columna queda TEXT libre.
--
-- Si en el futuro quieres normalización a nivel DB, mejor con un trigger
-- BEFORE INSERT que coerza categorías desconocidas a 'Otro' (no con CHECK).
-- ============================================================

ALTER TABLE public.movements
  DROP CONSTRAINT IF EXISTS movements_category_check;
