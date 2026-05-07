-- ============================================================
-- 022_oauth_display_name.sql
--
-- Soporte para OAuth (v0.3): cuando el user entra con Google por primera
-- vez, Supabase crea un row en auth.users con `raw_user_meta_data` que
-- contiene `full_name` y `name` (no `display_name` como nuestro signup
-- email/password). El trigger `handle_new_user` solo leía `display_name`,
-- entonces los usuarios Google caían al fallback `email.split('@')[0]`
-- (ej. "juan.perez" en lugar de "Juan Pérez").
--
-- Fix: leer también `full_name` y `name` antes del fallback. Sigue
-- preservando display_name de nuestro signup (precedencia más alta para
-- no romper el flow existente).
--
-- NOTA: este trigger solo dispara cuando se crea un row NUEVO en
-- auth.users. Cuando un user ya existente con email/password entra por
-- primera vez con Google, Supabase agrega una identity nueva al mismo
-- row (no crea uno nuevo) y el trigger NO se dispara — su profile.display_name
-- existente queda intacto. Este es el comportamiento deseado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      -- 1. Nuestro signup email/password manda esto en options.data
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      -- 2. Google OAuth manda `full_name` (estándar OIDC)
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      -- 3. Otros providers usan `name`
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      -- 4. Fallback: parte antes del @ del email
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;
