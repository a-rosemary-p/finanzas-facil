-- ============================================================
-- fiza v0.4 — Sincronizar profiles.email cuando cambia auth.users.email
-- ============================================================

-- Trigger para mantener profiles.email en sync cuando el usuario
-- confirma un cambio de correo desde su bandeja de entrada.
CREATE OR REPLACE FUNCTION public.sync_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_to_profile();
