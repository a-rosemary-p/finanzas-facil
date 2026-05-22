-- ============================================================
-- 024_projects.sql
--
-- Feature: Proyectos (v0.5) — Pro-only.
--
-- Agrupa movimientos relacionados a un mismo trabajo o cliente para que el
-- freelancer pueda ver rentabilidad real por proyecto.
--
-- Cambios:
--   1. Tabla nueva: projects (id, name, client_name, status, notes, dates)
--      con RLS, GRANT UPDATE whitelist, y trigger BEFORE INSERT que hace
--      cumplir el tope de 10 activos por usuario.
--   2. movements.project_id (FK nullable, ON DELETE SET NULL — al borrar un
--      proyecto los movimientos quedan como overhead general, no se pierden).
--   3. recurring_movements.project_id (mismo patrón).
--   4. movement_events.event_type: recrear CHECK para sumar
--      'project_ai_suggested' y 'project_assigned' al audit trail.
--   5. profiles.include_archived_in_metrics — toggle de Ajustes default true.
--      Si OFF, las vistas globales (inicio + reportes) excluyen movs de
--      proyectos archivados.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLA projects
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  client_name   TEXT NULL CHECK (client_name IS NULL OR length(client_name) BETWEEN 1 AND 60),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  notes         TEXT NULL CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMPTZ NULL
);

-- Índices: listing por status, autocomplete por cliente.
CREATE INDEX IF NOT EXISTS idx_projects_user_status
  ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_user_client_lower
  ON public.projects(user_id, lower(client_name))
  WHERE client_name IS NOT NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4 policies separadas (mismo patrón que recurring_movements)
DROP POLICY IF EXISTS projects_select_own ON public.projects;
DROP POLICY IF EXISTS projects_insert_own ON public.projects;
DROP POLICY IF EXISTS projects_update_own ON public.projects;
DROP POLICY IF EXISTS projects_delete_own ON public.projects;

CREATE POLICY projects_select_own ON public.projects
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY projects_insert_own ON public.projects
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY projects_update_own ON public.projects
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY projects_delete_own ON public.projects
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Column-level GRANT — solo permitimos UPDATE de campos editables.
-- user_id/created_at no se mueven; status va via endpoint dedicado.
REVOKE UPDATE ON public.projects FROM anon, authenticated;
GRANT UPDATE (
  name,
  client_name,
  status,
  notes,
  archived_at,
  updated_at
) ON public.projects TO authenticated;

COMMENT ON TABLE public.projects IS
  'Proyectos para agrupar movimientos. Pro-only (gate en endpoints). Tope de 10 activos por usuario via trigger BEFORE INSERT.';
COMMENT ON COLUMN public.projects.client_name IS
  'Snapshot denormalizado del cliente/proveedor. No hay tabla clientes separada — autocomplete sale de SELECT DISTINCT client_name FROM projects.';
COMMENT ON COLUMN public.projects.status IS
  'active = visible en /proyectos y en métricas; archived = oculto de la vista activa pero los movs siguen contando (salvo que el user apague include_archived_in_metrics).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER: tope de 10 proyectos activos por usuario
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Defense-in-depth además del check en /api/projects POST. Cubre también:
--   - reapertura (UPDATE status archived → active)
--   - cualquier insert directo via service_role o futura RPC
--
-- Cuenta SOLO los activos. Archivados no consumen el cupo.

CREATE OR REPLACE FUNCTION public.enforce_max_active_projects()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INTEGER;
  v_limit        CONSTANT INTEGER := 10;
BEGIN
  -- Solo nos importa cuando la fila resultante quedaría activa.
  -- En UPDATE, si ya estaba activa (OLD.status='active'), no cambia el conteo.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;  -- ya contaba, sigue contando, sin delta.
  END IF;

  SELECT COUNT(*) INTO v_active_count
    FROM public.projects
   WHERE user_id = NEW.user_id
     AND status = 'active'
     AND id <> NEW.id;  -- excluye la fila actual en UPDATE de archived→active

  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION 'max_active_projects_exceeded'
      USING ERRCODE = 'P0001',
            HINT = 'Archiva un proyecto antes de crear o reabrir otro.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS enforce_max_active_projects_trigger ON public.projects;
CREATE TRIGGER enforce_max_active_projects_trigger
  BEFORE INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_active_projects();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER: mantener updated_at + archived_at coherentes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_projects_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();

  -- archived_at se setea/limpia automáticamente al cambiar status.
  -- Permitimos que el endpoint también lo setee explícitamente (idempotente).
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := NOW();
    ELSIF NEW.status = 'active' THEN
      NEW.archived_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS touch_projects_timestamps_trigger ON public.projects;
CREATE TRIGGER touch_projects_timestamps_trigger
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_projects_timestamps();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. movements.project_id + recurring_movements.project_id
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ON DELETE SET NULL: al borrar un proyecto los movimientos quedan como
-- overhead general (project_id IS NULL). Conservamos la historia financiera.

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS project_id UUID NULL
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movements_project
  ON public.movements(project_id)
  WHERE project_id IS NOT NULL;

-- Índice combinado para "movimientos del proyecto X del user Y ordenados por fecha"
CREATE INDEX IF NOT EXISTS idx_movements_user_project_date
  ON public.movements(user_id, project_id, movement_date DESC)
  WHERE project_id IS NOT NULL;

ALTER TABLE public.recurring_movements
  ADD COLUMN IF NOT EXISTS project_id UUID NULL
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_movements_project
  ON public.recurring_movements(project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.movements.project_id IS
  'Proyecto al que pertenece el movimiento. NULL = overhead general / sin proyecto. ON DELETE SET NULL — borrar el proyecto desasigna pero no borra movs.';
COMMENT ON COLUMN public.recurring_movements.project_id IS
  'Si el recurrente pertenece a un proyecto, todos los pendientes que se materialicen heredan ese project_id. ON DELETE SET NULL.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. movement_events: tipos nuevos para audit de proyectos
-- ─────────────────────────────────────────────────────────────────────────────
--
-- NO recreamos el CHECK — migration 011 lo dropeó explícitamente para no
-- requerir una migración cada vez que sumamos un event_type. La validación
-- vive en la app (TypeScript union type + handler que solo inserta tipos
-- conocidos). Los nuevos tipos que se insertarán desde código:
--
--   project_ai_suggested — la IA propuso un proyecto al extraer. Payload:
--     { description, suggested_project_id?, suggested_create_name?, confidence }
--   project_assigned     — se asignó (o cambió) el project_id de un movimiento.
--     Payload: { prev_project_id, new_project_id, source: 'ai' | 'manual' }


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. profiles.include_archived_in_metrics — toggle de Ajustes (Pro-only en UI)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Default TRUE para preservar el comportamiento actual (todos los movs cuentan).
-- Si el user apaga el toggle, /inicio cards y /reportes excluyen movs cuyo
-- project_id apunta a un proyecto archived. Sin afectar /proyectos en sí
-- (esa página tiene su propio filtro activos/archivados).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS include_archived_in_metrics BOOLEAN NOT NULL DEFAULT TRUE;

-- Sumar a la whitelist de columnas updateables por el user.
GRANT UPDATE (include_archived_in_metrics) ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.include_archived_in_metrics IS
  'Pref del user: si false, /inicio y /reportes excluyen movs de proyectos archivados. Default true. El filtrado se aplica server-side en queries de movimientos.';
