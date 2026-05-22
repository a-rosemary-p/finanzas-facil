-- 026_projects_onboarding.sql
-- Flag para mostrar el modal de onboarding del feature de Proyectos
-- una sola vez por user Pro. NULL = no lo ha visto.
-- Para Pros existentes (Oscar, Ximena) al actualizar a v0.5 entran a /inicio
-- y se les dispara el modal. Para nuevos Pros, también — al hacer upgrade
-- desde Free, la próxima visita a /inicio les muestra el modal.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS projects_onboarded_at TIMESTAMPTZ;

GRANT UPDATE (projects_onboarded_at) ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.projects_onboarded_at IS
  'Timestamp cuando el user vio el modal de onboarding de Proyectos (v0.5). NULL = pendiente. Se setea en POST /api/onboarding/projects-seen.';
