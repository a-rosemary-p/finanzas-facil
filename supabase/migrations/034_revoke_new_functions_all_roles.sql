-- ============================================================
-- 034_revoke_new_functions_all_roles.sql
--
-- CORRECCIÓN de las migraciones 032 y 033.
--
-- Las funciones nuevas creadas en esta sesión (`enforce_free_plan_limit_stmt`,
-- `check_ip_rate_limit`, `cleanup_rate_limit_windows`) hacían
-- `REVOKE EXECUTE ... FROM PUBLIC` y quedaron igual accesibles para `anon` y
-- `authenticated`.
--
-- Por qué: Supabase configura DEFAULT PRIVILEGES en el schema `public` que
-- otorgan EXECUTE **explícitamente** a `anon`, `authenticated` y `service_role`
-- en cada función nueva. Revocar a PUBLIC no toca esos grants explícitos.
-- La ACL lo mostraba así:
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   (nótese que la entrada `=X/` de PUBLIC sí desapareció — el revoke funcionó,
--    pero era insuficiente.)
--
-- Es el ERROR ESPEJO del de la migración 030→031: ahí se revocó a los roles y
-- PUBLIC seguía teniendo el privilegio; acá se revocó a PUBLIC y los roles
-- seguían teniéndolo explícitamente.
--
-- REGLA A SEGUIR de aquí en adelante, para funciones que NO deben ser
-- invocables por clientes: revocar SIEMPRE a los tres —
--   REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;
-- y verificar con `SET LOCAL ROLE authenticated` + llamada real, nunca solo
-- leyendo la ACL (que es fácil de malinterpretar en ambas direcciones).
-- ============================================================

-- Triggers y helpers de cron: ningún cliente tiene por qué llamarlos.
REVOKE EXECUTE ON FUNCTION public.enforce_free_plan_limit_stmt()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_windows()    FROM PUBLIC, anon, authenticated;

-- Rate limit por IP: solo el server (service_role) la usa. Si un cliente
-- pudiera llamarla, podría inflar el contador de la IP de otro para bloquearlo,
-- o gastar filas con IPs arbitrarias (esta tabla no tiene FK que lo limite,
-- a diferencia de `rate_limits.user_id`).
REVOKE EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- service_role conserva su grant explícito (lo necesita el helper
-- lib/ip-rate-limit.ts). Se re-otorga por idempotencia.
GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer)
  TO service_role;
