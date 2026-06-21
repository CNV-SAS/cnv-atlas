-- RLS de survey_links (B7). Sigue el modelo de 0003_rls.sql.
--
-- Modelo de acceso:
--   - SELECT: el profesional dueno del link (su professional_profile) y admin. La
--     lectura publica del token en el intake la hace service_role (BYPASSRLS), no
--     una sesion; por eso no hay policy para anon.
--   - INSERT: el profesional emite sus propios links (con su sesion) y admin. El
--     organization_id/professional_id se validan contra el profesional autenticado.
--   - UPDATE/DELETE: sin policy. Consumir o expirar el link lo hace el intake via
--     service_role; no se edita por sesion (mismo patron que survey_responses).

alter table public.survey_links enable row level security;--> statement-breakpoint

create policy "survey_links_select" on public.survey_links
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = survey_links.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint

create policy "survey_links_insert" on public.survey_links
  for insert to authenticated with check (
    public.has_role('admin') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = survey_links.professional_id and pp.profile_id = auth.uid()
    )
  );
