-- P0 Parte 2: la trayectoria de EB-BIS (3 bandas) SELLADA al crear el reporte de un seguimiento, con
-- el corte provisional con que se calculo. Se sella en el INSERT (draft) y no se toca despues.
ALTER TABLE "reports" ADD COLUMN "trajectory" jsonb;--> statement-breakpoint

-- Extiende el trigger de inmutabilidad para congelar tambien `trajectory` (como el snapshot): una vez
-- sellada, no se modifica. Es defensivo: se setea en el INSERT y nadie la UPDATE-a (approveReport y
-- markReportSent no la tocan, asi que new.trajectory = old.trajectory y no dispara). CREATE OR REPLACE
-- reemplaza solo el cuerpo; el trigger sigue igual.
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
  return new;
end;
$$;