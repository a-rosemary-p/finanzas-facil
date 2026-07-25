-- ============================================================
-- 031_revoke_rpc_from_public.sql
--
-- CORRECCIÓN de la migración 030.
--
-- La 030 hizo `REVOKE EXECUTE ... FROM anon, authenticated` sobre las 12
-- funciones SECURITY DEFINER. Eso NO tuvo ningún efecto real.
--
-- Por qué falló: en Postgres, `CREATE FUNCTION` otorga EXECUTE al pseudo-rol
-- `PUBLIC` por default. `PUBLIC` cubre a TODOS los roles, así que revocar a
-- roles específicos no quita nada mientras el grant a PUBLIC siga ahí.
-- La ACL cruda lo mostraba como la entrada `=X/postgres` (grantee vacío =
-- PUBLIC, privilegio X = EXECUTE).
--
-- Cómo se detectó: la verificación inicial usó `aclexplode` filtrando por
-- rolname IN ('anon','authenticated'), y un grant a PUBLIC tiene grantee OID 0
-- que no matchea ninguna fila de pg_roles — o sea, la query daba FALSO
-- POSITIVO (parecía revocado). La prueba real fue `SET LOCAL ROLE authenticated`
-- + llamar la función: ejecutó sin error en lugar de dar "permission denied".
--
-- LECCIÓN para futuras auditorías de grants: no confíes en aclexplode filtrado
-- por nombre de rol; revisa `proacl::text` cruda (buscando la entrada `=X/`) y
-- valida empíricamente con SET LOCAL ROLE.
--
-- Nota sobre triggers: revocar EXECUTE NO rompe los triggers. Postgres no
-- chequea privilegio EXECUTE cuando dispara un trigger; solo importa para
-- llamadas directas (que es exactamente el vector de RPC que queremos cerrar).
-- Validado empíricamente post-revoke con un INSERT en `movements` bajo el rol
-- `authenticated` (dispara enforce_free_plan_limit + count_daily_movements +
-- update_total_movements) — ver comentario al final.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Las 11 funciones internas: cerrar por completo.
--    Quedan accesibles solo para `postgres` (cron) y `service_role`, que
--    tienen grants explícitos.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.materialize_next_pending(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.materialize_overdue_recurrings()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_daily_movement_counters()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_daily_movements()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_free_plan_limit()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_max_active_projects()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_email_to_profile()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_projects_timestamps()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_total_movements()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                   FROM PUBLIC;

-- ------------------------------------------------------------
-- 2. `check_rate_limit`: quitar PUBLIC pero MANTENER `authenticated`.
--
--    La app la llama desde lib/rate-limit.ts con el JWT del propio usuario.
--    Si se cierra del todo, el rate limiting deja de funcionar EN SILENCIO
--    (consumeRateLimit falla-abierto), dejando los endpoints de OpenAI sin
--    límite. La 030 ya le agregó el guard `p_user_id = auth.uid()` adentro,
--    así que un usuario autenticado solo puede consumir su propio contador.
--
--    Tras el REVOKE FROM PUBLIC, el grant explícito `authenticated=X/postgres`
--    (agregado abajo por idempotencia) es lo que la mantiene funcionando.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO authenticated;
