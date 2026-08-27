-- Descarte del aviso de alergeno: tabla de dominio propia.
--
-- POR QUE EXISTE ESTA TABLA, Y POR QUE NO BASTABA EL AUDIT LOG. El descarte se guardaba SOLO en
-- clinical_audit_log. La escritura funcionaba (el evento quedaba, con actor y motivo), pero la pantalla
-- NUNCA lo mostraba: `clinical_audit_log` es **solo admin** para SELECT, asi que la consulta del reader,
-- que corre con la sesion del profesional, devolvia vacio siempre. El nutricionista descartaba, leia
-- "registrado", y no encontraba el descarte por ningun lado.
--
-- El defecto es de EXPOSICION, no de escritura, y es el mismo error de elegir un almacen por una de sus
-- propiedades (que fuera inmutable y auditado) sin verificar la otra (que el que lo tiene que leer pueda
-- leerlo). Se detecto en el smoke, que es donde tenia que detectarse.
--
-- El reparto queda como en el resto del sistema: **el audit log es la TRAZA, la tabla de dominio es el
-- ESTADO que la pantalla lee**. Los dos se escriben en la MISMA transaccion, asi que no pueden divergir.
-- Es lo que ya hace el reenvio de reportes (resent_count en el dominio, report.resent en la traza).
--
-- Y LO QUE GARANTIZABA EL DISENO ANTERIOR SE CONSERVA: el descarte NO borra el aviso. Sigue viviendo
-- fuera de ai_menu_suggestions, que es inmutable, asi que el hallazgo no se puede tocar ni queriendo.
-- Descartar es decir "lo mire y esta bien", no "no paso nada".
--
-- UNO POR SUGERENCIA (pk sobre suggestion_id): descartar dos veces el mismo aviso no crea historia, es
-- la misma decision. Si alguien vuelve a enviarlo, gana el ultimo y la traza conserva los dos intentos.

create table if not exists menu_allergen_dismissals (
  suggestion_id uuid primary key references ai_menu_suggestions(id) on delete cascade,
  dismissed_by uuid not null references profiles(id),
  dismissed_by_email text not null,
  reason text not null,
  dismissed_at timestamptz not null default now()
);--> statement-breakpoint

comment on table menu_allergen_dismissals is
  'Descarte del aviso de alergeno de una sugerencia de menu: quien, cuando y por que. Estado de dominio que la pantalla LEE; la traza del mismo hecho vive en clinical_audit_log (solo admin). Se escriben juntos en la misma transaccion.';

alter table menu_allergen_dismissals enable row level security;--> statement-breakpoint

-- Misma visibilidad que la sugerencia a la que pertenece: si el profesional puede ver el menu, puede ver
-- quien descarto su aviso. Espejo exacto de ai_menu_suggestions_select, para que no haya un caso en que
-- se vea el aviso y no su descarte (o al reves).
create policy "menu_allergen_dismissals_select" on public.menu_allergen_dismissals
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.ai_menu_suggestions s
      join public.treatments t on t.id = s.treatment_id
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where s.id = menu_allergen_dismissals.suggestion_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- Sin policy de INSERT/UPDATE por sesion: se escribe por service_role dentro de la transaccion que
-- tambien deja el evento en el audit log, igual que el resto de los hechos clinicos.
