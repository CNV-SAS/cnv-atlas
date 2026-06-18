-- Triggers. DATABASE.md, seccion "Triggers" (set_updated_at, prevent_audit_mutation)
-- mas handle_new_user, que materializa public.profiles al crear un auth.users
-- (DATABASE.md "Seed deterministico": el trigger materializa profiles).

-- updated_at: mueve la marca en cada UPDATE. Se porta verbatim del doc (sin
-- security definer: corre como invocador, basta con tocar la fila nueva).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
--> statement-breakpoint

-- Aplicar a cada tabla con updated_at (lista del doc).
create trigger set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.professional_profiles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.patient_profiles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.patient_contacts
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.evaluations
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.devices
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.nutraceuticals
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- Append-only del audit clinico: bloquea UPDATE/DELETE incluso con service role
-- (regla dura 8). Se porta verbatim del doc.
create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'clinical_audit_log es append-only: no se permite % ', tg_op;
end;
$$;
--> statement-breakpoint
create trigger clinical_audit_no_update
  before update or delete on public.clinical_audit_log
  for each row execute function public.prevent_audit_mutation();
--> statement-breakpoint

-- Materializa profiles al crear el auth user. security definer (escribe en
-- public.profiles, que tiene RLS) con set search_path = '' por la convencion de
-- hardening. organization_id y full_name vienen del user_metadata que fija el
-- seed/alta de usuario (no hay auto-registro). Si falta organization_id, el
-- insert viola NOT NULL y aborta la creacion: no se crea un profile sin tenant.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, organization_id, email, full_name)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'organization_id')::uuid,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;
--> statement-breakpoint
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
