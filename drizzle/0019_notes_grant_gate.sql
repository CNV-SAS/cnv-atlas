-- Cierra el acceso incondicional de admin a las notas narrativas y abre el Nivel (b)
-- gateado por grant. Reescribe las tres policies SELECT (evaluation_notes,
-- diagnosis_notes, treatment_notes): se quita public.has_role('admin') (era un acceso
-- continuo, identificado y sin registro, que violaba la Clausula 17 del Anexo 3) y se
-- agrega la rama de auditoria seudonimizada: un grant notes_pseudonymous activo MAS la
-- precondicion de que el profesional del paciente firmo la version vigente del Anexo 3.
--
-- El profesional dueno sigue viendo las notas de sus pacientes por la via normal
-- (is_patient_professional), sin cambios. El acceso identificado (Nivel c) NO pasa por
-- estas policies: va por una accion de servidor auditada (migracion/ST siguiente), nunca
-- por RLS relajada. Los INSERT de notas no cambian (el profesional escribe las suyas).
--
-- Forward-only: se hace drop + create de cada policy SELECT (una policy aplicada no se
-- modifica en sitio).

drop policy "evaluation_notes_select" on public.evaluation_notes;--> statement-breakpoint
create policy "evaluation_notes_select" on public.evaluation_notes
  for select to authenticated using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_notes.evaluation_id
        and (
          public.is_patient_professional(e.patient_id)
          or (
            public.has_active_grant('notes_pseudonymous')
            and public.patient_professional_anexo3_current(e.patient_id)
          )
        )
    )
  );--> statement-breakpoint

drop policy "diagnosis_notes_select" on public.diagnosis_notes;--> statement-breakpoint
create policy "diagnosis_notes_select" on public.diagnosis_notes
  for select to authenticated using (
    exists (
      select 1 from public.diagnoses d
      join public.evaluations e on e.id = d.evaluation_id
      where d.id = diagnosis_notes.diagnosis_id
        and (
          public.is_patient_professional(e.patient_id)
          or (
            public.has_active_grant('notes_pseudonymous')
            and public.patient_professional_anexo3_current(e.patient_id)
          )
        )
    )
  );--> statement-breakpoint

drop policy "treatment_notes_select" on public.treatment_notes;--> statement-breakpoint
create policy "treatment_notes_select" on public.treatment_notes
  for select to authenticated using (
    exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = treatment_notes.treatment_id
        and (
          public.is_patient_professional(e.patient_id)
          or (
            public.has_active_grant('notes_pseudonymous')
            and public.patient_professional_anexo3_current(e.patient_id)
          )
        )
    )
  );
