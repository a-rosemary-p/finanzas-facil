-- ============================================================
-- 025_projects_unique_active_name.sql
--
-- Hardening del feature de Proyectos (v0.5).
--
-- 1. UNIQUE INDEX parcial sobre (user_id, lower(name)) WHERE status='active'.
--    Cierra una race condition: dos requests concurrentes de /api/entry/confirm
--    (o /api/projects POST) con el mismo projectCreateName terminaban creando
--    dos proyectos activos duplicados (el dedupe en memoria no protege bajo
--    concurrencia). El UNIQUE INDEX deja que solo uno gane; el handler atrapa
--    el conflict y reusa el id existente.
--
--    Permite mismo nombre en archivados (caso: "Proyecto X" archivado, user
--    crea uno nuevo "Proyecto X" con cliente distinto — válido).
--
-- 2. GRANT UPDATE de projects.updated_at y archived_at se quita — el trigger
--    touch_projects_timestamps los maneja y el cliente no debería tocarlos.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_active_name_lower_uq
  ON public.projects (user_id, lower(name))
  WHERE status = 'active';

-- Re-emitimos el GRANT sin updated_at ni archived_at. Patrón: REVOKE + GRANT
-- limpia el conjunto (sino quedan columnas residuales del GRANT de 024).
REVOKE UPDATE ON public.projects FROM authenticated;
GRANT UPDATE (
  name,
  client_name,
  status,
  notes
) ON public.projects TO authenticated;

COMMENT ON INDEX public.projects_user_active_name_lower_uq IS
  'Único activos por user case-insensitive. Archivados pueden compartir nombre con activos.';
