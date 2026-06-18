-- RLS: enable + policies en las 55 tablas. DATABASE.md ("RLS: patrones y ejemplos")
-- mas la matriz aprobada por Santiago.
--
-- Modelo de escritura: el 99% via sesion del usuario (rol authenticated) gobernada
-- por estas policies; las escrituras mediadas por el sistema (auditoria inline,
-- webhooks de pago, salida del motor, exports anonimizados) van por service_role,
-- que tiene BYPASSRLS. Por eso varias tablas NO llevan policy de escritura: la
-- escritura legitima la hace service_role, no la sesion.
--
-- Convencion: una policy por comando y tabla, con condiciones OR por rol. Las
-- relaciones a varios saltos se resuelven con EXISTS calificado por esquema.

-- =========================================================================
-- 0. Habilitar RLS en TODAS las tablas (regla dura: sin excepcion).
-- =========================================================================
alter table public.organizations enable row level security;--> statement-breakpoint
alter table public.profiles enable row level security;--> statement-breakpoint
alter table public.roles enable row level security;--> statement-breakpoint
alter table public.user_roles enable row level security;--> statement-breakpoint
alter table public.professional_profiles enable row level security;--> statement-breakpoint
alter table public.professional_certifications enable row level security;--> statement-breakpoint
alter table public.patients enable row level security;--> statement-breakpoint
alter table public.patient_profiles enable row level security;--> statement-breakpoint
alter table public.patient_contacts enable row level security;--> statement-breakpoint
alter table public.patient_consents enable row level security;--> statement-breakpoint
alter table public.patient_professional_relationships enable row level security;--> statement-breakpoint
alter table public.model_versions enable row level security;--> statement-breakpoint
alter table public.model_variables enable row level security;--> statement-breakpoint
alter table public.indicator_definitions enable row level security;--> statement-breakpoint
alter table public.indicator_ranges enable row level security;--> statement-breakpoint
alter table public.phenotypes enable row level security;--> statement-breakpoint
alter table public.fr_sectors enable row level security;--> statement-breakpoint
alter table public.efr_states enable row level security;--> statement-breakpoint
alter table public.survey_templates enable row level security;--> statement-breakpoint
alter table public.survey_versions enable row level security;--> statement-breakpoint
alter table public.survey_questions enable row level security;--> statement-breakpoint
alter table public.survey_options enable row level security;--> statement-breakpoint
alter table public.survey_responses enable row level security;--> statement-breakpoint
alter table public.survey_answers enable row level security;--> statement-breakpoint
alter table public.evaluations enable row level security;--> statement-breakpoint
alter table public.evaluation_notes enable row level security;--> statement-breakpoint
alter table public.devices enable row level security;--> statement-breakpoint
alter table public.bis_variables enable row level security;--> statement-breakpoint
alter table public.bis_measurements enable row level security;--> statement-breakpoint
alter table public.bis_raw_values enable row level security;--> statement-breakpoint
alter table public.bis_import_logs enable row level security;--> statement-breakpoint
alter table public.indicator_values enable row level security;--> statement-breakpoint
alter table public.diagnoses enable row level security;--> statement-breakpoint
alter table public.diagnosis_notes enable row level security;--> statement-breakpoint
alter table public.ai_menu_suggestions enable row level security;--> statement-breakpoint
alter table public.treatments enable row level security;--> statement-breakpoint
alter table public.treatment_nutraceuticals enable row level security;--> statement-breakpoint
alter table public.treatment_diet_guidelines enable row level security;--> statement-breakpoint
alter table public.treatment_notes enable row level security;--> statement-breakpoint
alter table public.followups enable row level security;--> statement-breakpoint
alter table public.followup_metrics enable row level security;--> statement-breakpoint
alter table public.reports enable row level security;--> statement-breakpoint
alter table public.device_assignments enable row level security;--> statement-breakpoint
alter table public.nutraceuticals enable row level security;--> statement-breakpoint
alter table public.nutraceutical_inventory enable row level security;--> statement-breakpoint
alter table public.nutraceutical_usage enable row level security;--> statement-breakpoint
alter table public.transactions enable row level security;--> statement-breakpoint
alter table public.transaction_items enable row level security;--> statement-breakpoint
alter table public.professional_revenue enable row level security;--> statement-breakpoint
alter table public.cnv_revenue enable row level security;--> statement-breakpoint
alter table public.payment_webhook_events enable row level security;--> statement-breakpoint
alter table public.research_datasets enable row level security;--> statement-breakpoint
alter table public.clinical_audit_log enable row level security;--> statement-breakpoint
alter table public.ai_config enable row level security;--> statement-breakpoint
alter table public.ai_prompts enable row level security;--> statement-breakpoint

-- =========================================================================
-- Tier E: organizacion y staff
-- =========================================================================
create policy "organizations_select" on public.organizations
  for select to authenticated using (true);--> statement-breakpoint
create policy "organizations_insert" on public.organizations
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "organizations_update" on public.organizations
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "organizations_delete" on public.organizations
  for delete to authenticated using (public.has_role('admin'));--> statement-breakpoint

create policy "profiles_select" on public.profiles
  for select to authenticated using (
    id = auth.uid() or public.has_role('admin') or public.has_role('soporte')
  );--> statement-breakpoint
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));--> statement-breakpoint

create policy "roles_select" on public.roles
  for select to authenticated using (true);--> statement-breakpoint

create policy "user_roles_select" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role('admin'));--> statement-breakpoint
create policy "user_roles_insert" on public.user_roles
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "user_roles_update" on public.user_roles
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "user_roles_delete" on public.user_roles
  for delete to authenticated using (public.has_role('admin'));--> statement-breakpoint

create policy "professional_profiles_select" on public.professional_profiles
  for select to authenticated using (
    profile_id = auth.uid() or public.has_role('admin') or public.has_role('soporte')
  );--> statement-breakpoint
create policy "professional_profiles_insert" on public.professional_profiles
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "professional_profiles_update" on public.professional_profiles
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "professional_certifications_select" on public.professional_certifications
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = professional_certifications.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "professional_certifications_insert" on public.professional_certifications
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "professional_certifications_update" on public.professional_certifications
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "professional_certifications_delete" on public.professional_certifications
  for delete to authenticated using (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Tier A: pacientes y PII
-- =========================================================================
create policy "patients_select" on public.patients
  for select to authenticated using (
    public.is_patient_professional(id) or public.has_role('admin') or public.has_role('soporte')
  );--> statement-breakpoint
create policy "patients_insert" on public.patients
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('professional'));--> statement-breakpoint
create policy "patients_update" on public.patients
  for update to authenticated
  using (public.is_patient_professional(id) or public.has_role('admin'))
  with check (public.is_patient_professional(id) or public.has_role('admin'));--> statement-breakpoint

create policy "patient_profiles_select" on public.patient_profiles
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "patient_profiles_insert" on public.patient_profiles
  for insert to authenticated
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint
create policy "patient_profiles_update" on public.patient_profiles
  for update to authenticated
  using (public.is_patient_professional(patient_id) or public.has_role('admin'))
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint

create policy "patient_contacts_select" on public.patient_contacts
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "patient_contacts_insert" on public.patient_contacts
  for insert to authenticated
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint
create policy "patient_contacts_update" on public.patient_contacts
  for update to authenticated
  using (public.is_patient_professional(patient_id) or public.has_role('admin'))
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint

create policy "patient_consents_select" on public.patient_consents
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "patient_consents_insert" on public.patient_consents
  for insert to authenticated
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint
-- UPDATE solo para revocar (set revoked_at); el repo toca solo esa columna.
create policy "patient_consents_update" on public.patient_consents
  for update to authenticated
  using (public.is_patient_professional(patient_id) or public.has_role('admin'))
  with check (public.is_patient_professional(patient_id) or public.has_role('admin'));--> statement-breakpoint

create policy "ppr_select" on public.patient_professional_relationships
  for select to authenticated using (
    public.has_role('admin') or public.has_role('soporte') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = patient_professional_relationships.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "ppr_insert" on public.patient_professional_relationships
  for insert to authenticated with check (
    public.has_role('admin') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = patient_professional_relationships.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "ppr_update" on public.patient_professional_relationships
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Tier D: registro del modelo y catalogos (lectura amplia, escritura admin)
-- =========================================================================
create policy "model_versions_select" on public.model_versions for select to authenticated using (true);--> statement-breakpoint
create policy "model_versions_write" on public.model_versions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "model_variables_select" on public.model_variables for select to authenticated using (true);--> statement-breakpoint
create policy "model_variables_write" on public.model_variables for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "indicator_definitions_select" on public.indicator_definitions for select to authenticated using (true);--> statement-breakpoint
create policy "indicator_definitions_write" on public.indicator_definitions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "indicator_ranges_select" on public.indicator_ranges for select to authenticated using (true);--> statement-breakpoint
create policy "indicator_ranges_write" on public.indicator_ranges for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "phenotypes_select" on public.phenotypes for select to authenticated using (true);--> statement-breakpoint
create policy "phenotypes_write" on public.phenotypes for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "fr_sectors_select" on public.fr_sectors for select to authenticated using (true);--> statement-breakpoint
create policy "fr_sectors_write" on public.fr_sectors for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "efr_states_select" on public.efr_states for select to authenticated using (true);--> statement-breakpoint
create policy "efr_states_write" on public.efr_states for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "bis_variables_select" on public.bis_variables for select to authenticated using (true);--> statement-breakpoint
create policy "bis_variables_write" on public.bis_variables for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Tier C: encuesta (contenido = admin; respuestas = solo service role)
-- =========================================================================
create policy "survey_templates_select" on public.survey_templates for select to authenticated using (true);--> statement-breakpoint
create policy "survey_templates_write" on public.survey_templates for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "survey_versions_select" on public.survey_versions for select to authenticated using (true);--> statement-breakpoint
create policy "survey_versions_write" on public.survey_versions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "survey_questions_select" on public.survey_questions for select to authenticated using (true);--> statement-breakpoint
create policy "survey_questions_write" on public.survey_questions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "survey_options_select" on public.survey_options for select to authenticated using (true);--> statement-breakpoint
create policy "survey_options_write" on public.survey_options for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- survey_responses / survey_answers: solo SELECT por sesion; el INSERT lo hace el
-- route handler de la encuesta (link al paciente) via service_role.
create policy "survey_responses_select" on public.survey_responses
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = survey_responses.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "survey_answers_select" on public.survey_answers
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.survey_responses sr
      join public.evaluations e on e.id = sr.evaluation_id
      where sr.id = survey_answers.response_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- =========================================================================
-- Tier B: flujo clinico (profesional del paciente + lectura admin)
-- =========================================================================
create policy "evaluations_select" on public.evaluations
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "evaluations_insert" on public.evaluations
  for insert to authenticated with check (public.is_patient_professional(patient_id));--> statement-breakpoint
create policy "evaluations_update" on public.evaluations
  for update to authenticated
  using (public.is_patient_professional(patient_id))
  with check (public.is_patient_professional(patient_id));--> statement-breakpoint

create policy "evaluation_notes_select" on public.evaluation_notes
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = evaluation_notes.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "evaluation_notes_insert" on public.evaluation_notes
  for insert to authenticated with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_notes.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "bis_measurements_select" on public.bis_measurements
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = bis_measurements.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "bis_measurements_insert" on public.bis_measurements
  for insert to authenticated with check (
    exists (
      select 1 from public.evaluations e
      where e.id = bis_measurements.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "bis_raw_values_select" on public.bis_raw_values
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.bis_measurements m
      join public.evaluations e on e.id = m.evaluation_id
      where m.id = bis_raw_values.measurement_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "bis_raw_values_insert" on public.bis_raw_values
  for insert to authenticated with check (
    exists (
      select 1 from public.bis_measurements m
      join public.evaluations e on e.id = m.evaluation_id
      where m.id = bis_raw_values.measurement_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "bis_import_logs_select" on public.bis_import_logs
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = bis_import_logs.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "bis_import_logs_insert" on public.bis_import_logs
  for insert to authenticated with check (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = bis_import_logs.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- indicator_values: salida del motor, INSERT solo service_role. Solo SELECT aqui.
create policy "indicator_values_select" on public.indicator_values
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = indicator_values.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- diagnoses: el motor inserta (service_role); el profesional solo confirma (UPDATE).
create policy "diagnoses_select" on public.diagnoses
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.evaluations e
      where e.id = diagnoses.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "diagnoses_update" on public.diagnoses
  for update to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = diagnoses.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = diagnoses.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "diagnosis_notes_select" on public.diagnosis_notes
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = diagnosis_notes.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "diagnosis_notes_insert" on public.diagnosis_notes
  for insert to authenticated with check (
    exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = diagnosis_notes.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- ai_menu_suggestions: inmutable por ausencia de UPDATE/DELETE (sin trigger).
create policy "ai_menu_suggestions_select" on public.ai_menu_suggestions
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = ai_menu_suggestions.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "ai_menu_suggestions_insert" on public.ai_menu_suggestions
  for insert to authenticated with check (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = ai_menu_suggestions.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "treatments_select" on public.treatments
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = treatments.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "treatments_insert" on public.treatments
  for insert to authenticated with check (
    exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = treatments.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "treatments_update" on public.treatments
  for update to authenticated
  using (
    exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = treatments.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = treatments.diagnosis_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- treatment_nutraceuticals / diet_guidelines: el profesional gestiona (incluye DELETE).
create policy "treatment_nutraceuticals_all" on public.treatment_nutraceuticals
  for all to authenticated
  using (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_nutraceuticals.treatment_id and public.is_patient_professional(e.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_nutraceuticals.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "treatment_nutraceuticals_admin_select" on public.treatment_nutraceuticals
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint

create policy "treatment_diet_guidelines_all" on public.treatment_diet_guidelines
  for all to authenticated
  using (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_diet_guidelines.treatment_id and public.is_patient_professional(e.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_diet_guidelines.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "treatment_diet_guidelines_admin_select" on public.treatment_diet_guidelines
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint

create policy "treatment_notes_select" on public.treatment_notes
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_notes.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "treatment_notes_insert" on public.treatment_notes
  for insert to authenticated with check (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_notes.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "nutraceutical_usage_select" on public.nutraceutical_usage
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = nutraceutical_usage.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
create policy "nutraceutical_usage_insert" on public.nutraceutical_usage
  for insert to authenticated with check (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = nutraceutical_usage.treatment_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "followups_select" on public.followups
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "followups_insert" on public.followups
  for insert to authenticated with check (public.is_patient_professional(patient_id));--> statement-breakpoint
create policy "followups_update" on public.followups
  for update to authenticated
  using (public.is_patient_professional(patient_id))
  with check (public.is_patient_professional(patient_id));--> statement-breakpoint

create policy "followup_metrics_select" on public.followup_metrics
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.followups f
      where f.id = followup_metrics.followup_id and public.is_patient_professional(f.patient_id)
    )
  );--> statement-breakpoint
create policy "followup_metrics_insert" on public.followup_metrics
  for insert to authenticated with check (
    exists (
      select 1 from public.followups f
      where f.id = followup_metrics.followup_id and public.is_patient_professional(f.patient_id)
    )
  );--> statement-breakpoint
create policy "followup_metrics_update" on public.followup_metrics
  for update to authenticated
  using (
    exists (
      select 1 from public.followups f
      where f.id = followup_metrics.followup_id and public.is_patient_professional(f.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.followups f
      where f.id = followup_metrics.followup_id and public.is_patient_professional(f.patient_id)
    )
  );--> statement-breakpoint

-- reports: snapshot inmutable (trigger abajo); el profesional aprueba/envia (UPDATE).
create policy "reports_select" on public.reports
  for select to authenticated using (
    public.is_patient_professional(patient_id) or public.has_role('admin')
  );--> statement-breakpoint
create policy "reports_insert" on public.reports
  for insert to authenticated with check (public.is_patient_professional(patient_id));--> statement-breakpoint
create policy "reports_update" on public.reports
  for update to authenticated
  using (public.is_patient_professional(patient_id))
  with check (public.is_patient_professional(patient_id));--> statement-breakpoint

-- =========================================================================
-- Tier E: comodato e inventario
-- =========================================================================
create policy "devices_select" on public.devices
  for select to authenticated using (public.has_role('admin') or public.has_role('soporte'));--> statement-breakpoint
create policy "devices_write" on public.devices
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "device_assignments_select" on public.device_assignments
  for select to authenticated using (
    public.has_role('admin') or public.has_role('soporte') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = device_assignments.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "device_assignments_insert" on public.device_assignments
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "device_assignments_update" on public.device_assignments
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "nutraceuticals_select" on public.nutraceuticals
  for select to authenticated using (true);--> statement-breakpoint
create policy "nutraceuticals_write" on public.nutraceuticals
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "nutraceutical_inventory_select" on public.nutraceutical_inventory
  for select to authenticated using (
    public.has_role('admin') or public.has_role('soporte') or public.has_role('direccion')
  );--> statement-breakpoint
create policy "nutraceutical_inventory_insert" on public.nutraceutical_inventory
  for insert to authenticated with check (public.has_role('admin') or public.has_role('soporte'));--> statement-breakpoint
create policy "nutraceutical_inventory_update" on public.nutraceutical_inventory
  for update to authenticated
  using (public.has_role('admin') or public.has_role('soporte'))
  with check (public.has_role('admin') or public.has_role('soporte'));--> statement-breakpoint
create policy "nutraceutical_inventory_delete" on public.nutraceutical_inventory
  for delete to authenticated using (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Tier F: finanzas (escritura = service_role; lectura restringida)
-- =========================================================================
create policy "transactions_select" on public.transactions
  for select to authenticated using (
    public.has_role('admin') or public.has_role('direccion') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = transactions.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "transaction_items_select" on public.transaction_items
  for select to authenticated using (
    public.has_role('admin') or public.has_role('direccion') or exists (
      select 1 from public.transactions tr
      join public.professional_profiles pp on pp.id = tr.professional_id
      where tr.id = transaction_items.transaction_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "professional_revenue_select" on public.professional_revenue
  for select to authenticated using (
    public.has_role('admin') or public.has_role('direccion') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = professional_revenue.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "cnv_revenue_select" on public.cnv_revenue
  for select to authenticated using (public.has_role('admin') or public.has_role('direccion'));--> statement-breakpoint
create policy "payment_webhook_events_select" on public.payment_webhook_events
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Tier G: investigacion, IA y auditoria
-- =========================================================================
create policy "research_datasets_select" on public.research_datasets
  for select to authenticated using (public.has_role('admin') or public.has_role('obbia'));--> statement-breakpoint
create policy "research_datasets_insert" on public.research_datasets
  for insert to authenticated with check (public.has_role('admin') or public.has_role('obbia'));--> statement-breakpoint
create policy "research_datasets_update" on public.research_datasets
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

create policy "ai_config_select" on public.ai_config
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint
create policy "ai_config_write" on public.ai_config
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint
create policy "ai_prompts_select" on public.ai_prompts
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint
create policy "ai_prompts_write" on public.ai_prompts
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- clinical_audit_log: solo admin lee. INSERT por service_role inline; UPDATE/DELETE
-- bloqueados por trigger (migracion 0002). Sin policy de escritura por sesion.
create policy "clinical_audit_log_select" on public.clinical_audit_log
  for select to authenticated using (public.has_role('admin'));--> statement-breakpoint

-- =========================================================================
-- Inmutabilidad del snapshot de reports (decision de Santiago). A diferencia del
-- audit log (bloqueo total), aqui se permite el UPDATE de workflow (status,
-- approved_by/at, sent_at, storage_path) pero se congela snapshot y se bloquea
-- DELETE: principio 4 (el reporte que el paciente recibio no se re-deriva).
-- =========================================================================
create or replace function public.prevent_report_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'reports es inmutable: no se permite DELETE';
  end if;
  if new.snapshot is distinct from old.snapshot then
    raise exception 'reports.snapshot es inmutable: no se permite modificarlo';
  end if;
  return new;
end;
$$;--> statement-breakpoint
create trigger reports_snapshot_immutable
  before update or delete on public.reports
  for each row execute function public.prevent_report_snapshot_mutation();
