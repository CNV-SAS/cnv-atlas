-- Storage buckets y policies. DATABASE.md, seccion "Storage buckets".
-- Dos buckets privados (public=false): patient-reports (PDF del paciente, PHI) y
-- comodato-docs (PDF del comodato firmado). El acceso del profesional a los
-- reportes es por URL firmada generada en un route handler con service role: el
-- path lleva patient_id y alli se valida is_patient_professional. RLS de
-- storage.objects ya viene habilitado por Supabase; aqui solo se agregan policies.
--
-- on conflict do nothing: por si el bucket ya existe (creado antes desde Studio),
-- la migracion no falla.

insert into storage.buckets (id, name, public)
values ('patient-reports', 'patient-reports', false)
on conflict (id) do nothing;--> statement-breakpoint

insert into storage.buckets (id, name, public)
values ('comodato-docs', 'comodato-docs', false)
on conflict (id) do nothing;--> statement-breakpoint

-- patient-reports: lectura directa solo admin. El profesional accede por URL
-- firmada (route handler valida is_patient_professional sobre el path). Subida de
-- PDFs solo por service role (los genera el sistema): sin policy de escritura.
create policy "patient_reports_admin_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-reports' and public.has_role('admin')
  );--> statement-breakpoint

-- comodato-docs: lectura admin/soporte; escritura solo admin (gestiona el comodato).
create policy "comodato_docs_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'comodato-docs' and (public.has_role('admin') or public.has_role('soporte'))
  );--> statement-breakpoint
create policy "comodato_docs_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'comodato-docs' and public.has_role('admin')
  );--> statement-breakpoint
create policy "comodato_docs_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'comodato-docs' and public.has_role('admin'))
  with check (bucket_id = 'comodato-docs' and public.has_role('admin'));--> statement-breakpoint
create policy "comodato_docs_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'comodato-docs' and public.has_role('admin')
  );
