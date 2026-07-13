-- RLS de professional_document_signatures + precondicion del Nivel (b).
-- Sigue el modelo de 0003_rls.sql (patron de professional_certifications) y
-- 0001_helpers_rls (helper security definer).
--
-- Acceso: el admin gestiona las firmas (INSERT/UPDATE); admin y soporte las leen, y
-- el profesional ve las suyas. La UI de gestion documental completa es un bloque
-- futuro (ver BACKLOG); aqui solo se abre lo minimo.

alter table public.professional_document_signatures enable row level security;--> statement-breakpoint

create policy "professional_document_signatures_select" on public.professional_document_signatures
  for select to authenticated using (
    public.has_role('admin') or public.has_role('soporte') or exists (
      select 1 from public.professional_profiles pp
      where pp.id = professional_document_signatures.professional_id and pp.profile_id = auth.uid()
    )
  );--> statement-breakpoint
create policy "professional_document_signatures_insert" on public.professional_document_signatures
  for insert to authenticated with check (public.has_role('admin'));--> statement-breakpoint
create policy "professional_document_signatures_update" on public.professional_document_signatures
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));--> statement-breakpoint

-- Precondicion del Nivel (b): un paciente solo entra en la auditoria seudonimizada si
-- su profesional firmo la version vigente del Anexo 3. El literal '1.0' refleja
-- ANEXO3_CURRENT_VERSION (src/modules/clinical-access/anexo3.ts), la unica fuente de la
-- version; si esa constante sube, hay que migrar este literal (el test de sincronia lo
-- verifica). Devuelve true si el paciente tiene al menos un profesional con el Anexo 3
-- vigente firmado; sin relacion o sin firma vigente => false.
create or replace function public.patient_professional_anexo3_current(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    join public.professional_document_signatures pds on pds.professional_id = ppr.professional_id
    where ppr.patient_id = p_patient_id
      and pds.document_type = 'anexo3'
      and pds.signed_version = '1.0'
  )
$$;
