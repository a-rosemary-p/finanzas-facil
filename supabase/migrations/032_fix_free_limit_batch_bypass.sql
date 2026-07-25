-- ============================================================
-- 032_fix_free_limit_batch_bypass.sql
--
-- BUG: el límite del plan Free (10 movimientos/día) se puede rebasar con un
-- INSERT en batch (varias filas en un solo statement).
--
-- Reproducción verificada en prod (dentro de transacción + ROLLBACK):
--   contador del día = 8 (le quedan 2)
--   INSERT ... SELECT de 5 filas en UN statement
--   → resultado: las 5 filas se insertaron, contador quedó en 13.
--
-- Causa raíz: en Postgres los triggers AFTER ROW se encolan y se ejecutan al
-- FINAL del statement, no entre filas. Entonces:
--   • `enforce_free_plan_limit` (BEFORE ROW) leyó `movements_today = 8` para
--     las 5 filas — ninguna vio el efecto de las anteriores, así que las 5
--     pasaron el check.
--   • `count_daily_movements` (AFTER ROW) corrió 5 veces al final, llevando el
--     contador a 13.
-- El `SELECT ... FOR UPDATE` del BEFORE no ayuda acá: el problema no es
-- concurrencia entre transacciones, es visibilidad dentro del mismo statement.
--
-- NOTA HISTÓRICA / CORRECCIÓN: esta fue la hipótesis inicial del bug "20/10"
-- que reportó un tester en jun 2026, y se descartó por error a favor del bug de
-- timezone seed (arreglado en la 029). Ahora está confirmado que eran AMBOS
-- bugs, independientes. El tester subió 2 fotos de estado de cuenta que
-- generaron 6 movimientos cada una — exactamente este caso de batch.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: el check de nivel app en
-- `/api/entry/confirm` (`sanitized.length > remaining` → 429) es bypasseable —
-- RLS permite que un usuario haga INSERT directo en `movements` con su propio
-- user_id vía PostgREST (`POST /rest/v1/movements` con un array). O sea, este
-- trigger era la ÚNICA defensa real del límite, y estaba abierta.
--
-- FIX: agregar un trigger AFTER INSERT ... FOR EACH STATEMENT con transition
-- table (`REFERENCING NEW TABLE`). Corre DESPUÉS de los AFTER ROW (o sea, con
-- el contador ya actualizado) y valida el total real. Si se rebasó, RAISE →
-- el statement completo hace rollback (nada de inserciones parciales).
--
-- Se conserva el BEFORE ROW existente: sigue siendo útil porque corta temprano
-- el caso secuencial (fila por fila) sin gastar trabajo de INSERT.
--
-- Se itera sobre `DISTINCT user_id` por robustez: hoy cada statement es de un
-- solo usuario (RLS lo garantiza), pero así el trigger es correcto también si
-- algún día un job con service_role inserta para varios.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_free_plan_limit_stmt()
RETURNS TRIGGER AS $$
DECLARE
  v_limit      CONSTANT INTEGER := 10;
  v_cdmx_today DATE := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
  r            RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT n.user_id
      FROM new_rows n
  LOOP
    -- Se lee el contador YA actualizado por count_daily_movements (AFTER ROW
    -- corre antes que AFTER STATEMENT).
    PERFORM 1
       FROM public.profiles p
      WHERE p.id = r.user_id
        AND p.plan = 'free'
        AND p.movements_today_date >= v_cdmx_today
        AND p.movements_today > v_limit;

    IF FOUND THEN
      RAISE EXCEPTION 'free_plan_limit_exceeded'
        USING ERRCODE = 'P0001',
              HINT = 'Upgrade a Pro para movimientos ilimitados';
    END IF;
  END LOOP;

  RETURN NULL; -- AFTER STATEMENT ignora el valor de retorno
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Cerrar el acceso por RPC (misma política que la migración 031).
REVOKE EXECUTE ON FUNCTION public.enforce_free_plan_limit_stmt() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_free_plan_limit_stmt_trigger ON public.movements;

CREATE TRIGGER enforce_free_plan_limit_stmt_trigger
  AFTER INSERT ON public.movements
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_free_plan_limit_stmt();
