-- 027_projects_active_lock.sql
-- v0.63: cierra TOCTOU race en enforce_max_active_projects().
-- Antes: COUNT(*) plain → dos INSERTs concurrentes con count=9 ambos pasan.
-- Ahora: pg_advisory_xact_lock por user_id → segundo INSERT espera al primero
-- y ve count actualizado (10 → falla correctamente).
-- El lock se libera automático al commit/rollback de la transacción.

CREATE OR REPLACE FUNCTION public.enforce_max_active_projects()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INTEGER;
  v_limit        CONSTANT INTEGER := 10;
BEGIN
  -- Solo nos importa cuando la fila resultante quedaría activa.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;  -- ya contaba, sigue contando, sin delta.
  END IF;

  -- Lock advisory por user_id. Serializa INSERT/UPDATE concurrentes del mismo
  -- user dentro de esta transacción. Otros users no se bloquean.
  -- hashtext devuelve int4 que cabe en pg_advisory_xact_lock(bigint).
  PERFORM pg_advisory_xact_lock(hashtext('projects_user_' || NEW.user_id::text));

  SELECT COUNT(*) INTO v_active_count
    FROM public.projects
   WHERE user_id = NEW.user_id
     AND status = 'active'
     AND id <> NEW.id;

  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION 'max_active_projects_exceeded'
      USING ERRCODE = 'P0001',
            HINT = 'Archiva un proyecto antes de crear o reabrir otro.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
