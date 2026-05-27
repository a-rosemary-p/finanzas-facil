-- v1.0: profiles.id necesita ON DELETE CASCADE para que borrar
-- auth.users cascada borre profile + cascada el resto de tablas
-- (movements, projects, recurring_movements, entries, etc.) que ya
-- tienen ON DELETE CASCADE sobre profiles o auth.users.
--
-- Sin esto, /api/profile/delete falla con FK violation.

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
