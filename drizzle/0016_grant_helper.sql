-- Helper de grants (security definer), gemelo SQL de hasActiveGrant (app-layer).
-- Mismo molde que 0001_helpers_rls: set search_path = '' e identificadores
-- calificados por esquema (previene search path hijacking). Se crea despues de
-- clinical_access_grants (0014) porque la consulta.
--
-- Lo consumen las policies de las notas para el Nivel (b) y, indirectamente, el
-- gate del Nivel (c). Concede solo si el usuario actual tiene un grant approved del
-- tipo pedido, no vencido (expires_at > now(); la expiracion es tiempo, no un
-- estado). Nivel (b): se llama sin resource_id (alcance amplio) y p_resource_id null
-- ignora el scope. Nivel (c): se pasa el patient_id y exige que el grant sea de ese
-- paciente.
create or replace function public.has_active_grant(
  p_grant_type public.access_grant_type,
  p_resource_id uuid default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.clinical_access_grants g
    where g.requester_id = auth.uid()
      and g.grant_type = p_grant_type
      and g.status = 'approved'
      and g.expires_at is not null
      and g.expires_at > now()
      and (p_resource_id is null or g.resource_id = p_resource_id)
  )
$$;
