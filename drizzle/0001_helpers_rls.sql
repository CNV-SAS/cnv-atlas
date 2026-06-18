-- Helpers RLS (security definer). DATABASE.md, seccion "Helpers RLS y hardening".
--
-- Por que security definer: estas funciones leen user_roles / relaciones que el
-- propio usuario no puede ver bajo RLS; corren con privilegios del owner para
-- resolver rol y ownership desde dentro de las policies sin abrir esas tablas.
-- Por que set search_path = '': una funcion security definer con search_path
-- mutable es vector de hijacking (un esquema temporal del atacante podria
-- suplantar tablas). Con search_path vacio, todo identificador va calificado por
-- esquema (public.*, auth.*), cerrando ese vector.
-- Se crean antes de las policies y del storage que las consumen (orden de
-- dependencias de DATABASE.md).

-- Roles del usuario actual (N:N).
create or replace function public.current_user_roles()
returns setof public.app_role
language sql stable security definer set search_path = ''
as $$
  select r.name from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
$$;
--> statement-breakpoint

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = p_role
  )
$$;
--> statement-breakpoint

-- El profesional del paciente (via relacion).
create or replace function public.is_patient_professional(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    join public.professional_profiles pp on pp.id = ppr.professional_id
    where ppr.patient_id = p_patient_id and pp.profile_id = auth.uid()
  )
$$;
