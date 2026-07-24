-- RLS de las condiciones de la toma BIS (Parte 2 de captura). Sigue 0003_rls.sql.
--
-- Modelo de acceso:
--   - Catalogo (bis_condition_versions, bis_conditions): lectura amplia para
--     authenticated (todos los profesionales cargan la lista activa), escritura solo
--     admin. Mismo Tier D que model_versions / survey_questions.
--   - Captura (evaluation_bis_intake): flujo clinico. El profesional del paciente
--     (via la evaluacion) y admin. SELECT/INSERT/UPDATE, sin DELETE (es registro
--     clinico sellado; no se borra por sesion, igual que survey/bis_measurements).

alter table public.bis_condition_versions enable row level security;--> statement-breakpoint
alter table public.bis_conditions enable row level security;--> statement-breakpoint
alter table public.evaluation_bis_intake enable row level security;--> statement-breakpoint

-- Catalogo versionado: lectura amplia, escritura admin.
create policy "bis_condition_versions_select" on public.bis_condition_versions
  for select to authenticated using (true);--> statement-breakpoint
create policy "bis_condition_versions_write" on public.bis_condition_versions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "bis_conditions_select" on public.bis_conditions
  for select to authenticated using (true);--> statement-breakpoint
create policy "bis_conditions_write" on public.bis_conditions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- Captura por evaluacion: el profesional del paciente (via la evaluacion) y admin.
create policy "evaluation_bis_intake_select" on public.evaluation_bis_intake
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = evaluation_bis_intake.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "evaluation_bis_intake_insert" on public.evaluation_bis_intake
  for insert to authenticated with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_bis_intake.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "evaluation_bis_intake_update" on public.evaluation_bis_intake
  for update to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_bis_intake.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_bis_intake.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );
