ALTER TABLE "reports" ADD COLUMN "trajectory_communicated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "trajectory_communicated_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_trajectory_communicated_by_profiles_id_fk" FOREIGN KEY ("trajectory_communicated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- P0 Parte 2 (P4): la confirmacion de comunicar un "empeoro" (trajectory_communicated_at/by) se setea
-- en draft (acto aparte de aprobar) y se CONGELA al aprobar, igual que professional_notes: una vez que
-- el reporte sale de draft, la decision de que se le comunico al paciente no se reescribe. CREATE OR
-- REPLACE reemplaza solo el cuerpo; el trigger sigue igual.
create or replace function public.prevent_report_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'reports es inmutable: no se permite DELETE';
  end if;
  if new.snapshot is distinct from old.snapshot then
    raise exception 'reports.snapshot es inmutable: no se permite modificarlo';
  end if;
  if new.trajectory is distinct from old.trajectory then
    raise exception 'reports.trajectory es inmutable: se sella al crear el reporte';
  end if;
  if old.status <> 'draft' and new.professional_notes is distinct from old.professional_notes then
    raise exception 'reports.professional_notes es inmutable tras la aprobacion';
  end if;
  if old.status <> 'draft'
     and (new.trajectory_communicated_at is distinct from old.trajectory_communicated_at
          or new.trajectory_communicated_by is distinct from old.trajectory_communicated_by) then
    raise exception 'reports: la confirmacion de comunicacion es inmutable tras la aprobacion';
  end if;
  return new;
end;
$$;