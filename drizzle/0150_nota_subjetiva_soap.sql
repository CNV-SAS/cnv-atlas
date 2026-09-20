-- ═══ EL APARTADO LIBRE DEL PROFESIONAL EN EL SOAP (la "S") ═══
--
-- QUE ES. La anamnesis que solo el profesional sabe: lo que el paciente contó en la consulta y no estaba
-- en la encuesta. Sin esto, el apartado Subjetivo se queda con lo que el paciente marcó en un formulario,
-- que es la mitad de lo que un clínico entiende por subjetivo.
--
-- ── POR QUE UNA TABLA Y NO UNA COLUMNA EN `treatment_notes` ──────────────────────────────────────
--
-- Era la opción obvia (ya es append-only, ya tiene autor y fecha) y se descartó por una razón práctica:
-- las observaciones de la consulta se LEEN en la historia clínica, y meter aquí otra clase de nota
-- obligaría a filtrar por un campo nuevo en un lector que hoy funciona. Un filtro que falte deja notas de
-- un apartado saliendo en el bloque del otro, y eso en un documento clínico es un error de atribución.
-- Con tabla propia, la historia clínica no se entera y no hay nada que pueda fallar en ella.
--
-- ── APPEND-ONLY, COMO SUS HERMANAS ──────────────────────────────────────────────────────────────
--
-- No se edita ni se borra: corregirse es escribir otra, y las dos quedan. Es la decisión de Gildardo para
-- las notas clínicas (§8) y coincide con el patrón defendible de las historias clínicas ajenas, donde una
-- corrección es un anexo que no altera el original.
--
-- Y ADEMAS RESUELVE LO QUE SANTIAGO PEDIA DEL SOAP: lo escrito a mano tiene que distinguirse de lo
-- generado. Aquí se distingue por construcción, porque vive en otro sitio y sale en su propio bloque con
-- su autor y su fecha; no hay forma de que se mezcle con la encuesta redactada.
--
-- ── LO QUE NO SE GUARDA ─────────────────────────────────────────────────────────────────────────
--
-- Ni versiones, ni "editado por": no hay edición. El rastro del acto va, como siempre, a
-- `clinical_audit_log` inline en la misma transacción (regla dura 8).

create table if not exists soap_subjective_notes (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  note text not null,
  author_id uuid not null references profiles(id) on delete restrict,
  author_email text not null,
  -- La profesión CON QUE se escribió, sellada aquí y no leída después: quien la escribe puede cambiar de
  -- rol, y el documento tiene que decir con qué profesión se asumió esa anamnesis.
  author_profession text,
  created_at timestamptz not null default now()
);--> statement-breakpoint

comment on table soap_subjective_notes is
  'Anamnesis del profesional para el apartado S del SOAP: lo que el paciente conto en consulta y no estaba en la encuesta. Append-only. Vive aparte de treatment_notes para que la historia clinica no tenga que filtrar por clase de nota.';--> statement-breakpoint

create index if not exists soap_subjective_notes_evaluation_idx
  on soap_subjective_notes (evaluation_id, created_at desc);--> statement-breakpoint

-- APPEND-ONLY POR TRIGGER, no por convención: una nota clínica que se puede editar deja de ser registro.
create or replace function public.prevent_soap_note_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'soap_subjective_notes es append-only: una correccion se escribe como nota nueva, no se edita ni se borra';
end;
$$;--> statement-breakpoint

drop trigger if exists soap_subjective_notes_append_only on public.soap_subjective_notes;--> statement-breakpoint
create trigger soap_subjective_notes_append_only
  before update or delete on public.soap_subjective_notes
  for each row execute function public.prevent_soap_note_mutation();--> statement-breakpoint

alter table soap_subjective_notes enable row level security;--> statement-breakpoint

-- Misma visibilidad que la evaluacion a la que pertenece: si el profesional puede ver al paciente, puede
-- leer y escribir su anamnesis. El admin lee (no escribe: no atiende pacientes).
create policy "soap_subjective_notes_select" on public.soap_subjective_notes
  for select to authenticated using (
    public.has_role('admin')
    or exists (
      select 1 from public.evaluations e
       where e.id = soap_subjective_notes.evaluation_id
         and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

create policy "soap_subjective_notes_insert" on public.soap_subjective_notes
  for insert to authenticated with check (
    exists (
      select 1 from public.evaluations e
       where e.id = soap_subjective_notes.evaluation_id
         and public.is_patient_professional(e.patient_id)
    )
  );
