-- T3b-3 ST2: sesion de conteo fisico de la consignacion. 0044 creo las tablas + la columna
-- count_session_id en los casos (DDL). Esta migracion (hand-written) pone RLS e inmutabilidad:
--   - El conteo es un HECHO registrado (evidencia de la obligacion semanal): append-only. Un reconteo es
--     una sesion nueva, no una edicion. Misma logica que los movimientos y las transiciones de faltante.
--   - RLS: el integrante dueño ve/registra SUS conteos; CNV (admin/soporte/direccion) ve (dato comercial).
-- Reproducible (CREATE OR REPLACE + DROP IF EXISTS).

ALTER TABLE "nutraceutical_count_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nutraceutical_count_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SELECT: el dueño o CNV. INSERT: el dueño (el conteo es su acto). Sin UPDATE/DELETE (append-only).
CREATE POLICY "nutra_count_sessions_select" ON "nutraceutical_count_sessions"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint
CREATE POLICY "nutra_count_sessions_insert" ON "nutraceutical_count_sessions"
  FOR INSERT TO authenticated WITH CHECK (
    public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint

-- Lineas: SELECT/INSERT segun el dueño de la sesion o CNV.
CREATE POLICY "nutra_count_lines_select" ON "nutraceutical_count_lines"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile(
      (select s.professional_id from public.nutraceutical_count_sessions s where s.id = session_id)
    )
  );--> statement-breakpoint
CREATE POLICY "nutra_count_lines_insert" ON "nutraceutical_count_lines"
  FOR INSERT TO authenticated WITH CHECK (
    public.is_own_professional_profile(
      (select s.professional_id from public.nutraceutical_count_sessions s where s.id = session_id)
    )
  );--> statement-breakpoint

-- Append-only: el conteo es evidencia; no se edita ni se borra (un reconteo es una sesion nueva).
create or replace function public.nutra_count_append_only() returns trigger
language plpgsql
as $$
begin
  raise exception 'el conteo fisico es un hecho registrado (append-only): un reconteo es una sesion nueva, no se edita ni se borra.';
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_count_sessions_append_only_trg ON nutraceutical_count_sessions;--> statement-breakpoint
CREATE TRIGGER nutra_count_sessions_append_only_trg
  BEFORE UPDATE OR DELETE ON nutraceutical_count_sessions
  FOR EACH ROW EXECUTE FUNCTION public.nutra_count_append_only();--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_count_lines_append_only_trg ON nutraceutical_count_lines;--> statement-breakpoint
CREATE TRIGGER nutra_count_lines_append_only_trg
  BEFORE UPDATE OR DELETE ON nutraceutical_count_lines
  FOR EACH ROW EXECUTE FUNCTION public.nutra_count_append_only();
