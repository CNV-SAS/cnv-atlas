ALTER TABLE "reports" ADD COLUMN "professional_notes" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "send_mode" text;--> statement-breakpoint
-- B10.1: extiende el trigger de inmutabilidad para congelar tambien professional_notes
-- una vez el reporte sale de draft (se fija en el paso draft->approved y despues es
-- inmutable, como el snapshot). send_mode NO se congela aqui: se sella al enviar.
-- CREATE OR REPLACE reemplaza solo el cuerpo de la funcion; el trigger sigue igual.
create or replace function public.prevent_report_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'reports es inmutable: no se permite DELETE';
  end if;
  if new.snapshot is distinct from old.snapshot then
    raise exception 'reports.snapshot es inmutable: no se permite modificarlo';
  end if;
  if old.status <> 'draft' and new.professional_notes is distinct from old.professional_notes then
    raise exception 'reports.professional_notes es inmutable tras la aprobacion';
  end if;
  return new;
end;
$$;