-- T3b-1: inventario de nutraceuticos en CONSIGNACION (el producto es de CNV, en custodia del integrante).
-- 0039 creo la tabla de movimientos, professional_id en el inventario y el unique (DDL generado). Esta
-- migracion (hand-written; drizzle-kit no genera triggers ni RLS) pone las garantias:
--   - RLS en las dos tablas (el profesional dueño ve/escribe lo suyo; admin/soporte ve, es dato COMERCIAL).
--   - El saldo (nutraceutical_inventory.stock_quantity) es un CACHE que SOLO mueve el trigger del
--     movimiento (mismo patron de coherencia que clinical_corrections/superseded_at, 0030): se recomputa
--     como la suma de los deltas; una escritura directa con otro valor se rechaza.
--   - Los movimientos son INMUTABLES (append-only): un error se corrige con un movimiento inverso.
-- Reproducible (CREATE OR REPLACE + DROP IF EXISTS).

-- === Helper: la fila es del profesional del usuario (security definer, como is_patient_professional). ===
create or replace function public.is_own_professional_profile(p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.professional_profiles pp
    where pp.id = p_professional_id and pp.profile_id = auth.uid()
  )
$$;--> statement-breakpoint

-- === RLS ===
ALTER TABLE "nutraceutical_stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SELECT movimientos: el profesional dueño, o admin/soporte (CNV es dueño del producto en consignacion;
-- el inventario es dato COMERCIAL, no clinico). OJO (T3b-2): el despacho llevara treatment_id -> paciente;
-- cuando exista, la vista de CNV debe separar el saldo (comercial) del vinculo con el paciente (clinico).
CREATE POLICY "nutra_movements_select" ON "nutraceutical_stock_movements"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint
-- INSERT: el profesional dueño registra SUS movimientos (canLoadOwnStock). Sin UPDATE/DELETE (inmutable):
-- RLS las niega por defecto y el trigger append_only las bloquea aunque se llegue por otra via.
CREATE POLICY "nutra_movements_insert" ON "nutraceutical_stock_movements"
  FOR INSERT TO authenticated WITH CHECK (
    public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint

-- SELECT inventario: igual (dueño o admin/soporte). Sin INSERT/UPDATE/DELETE de usuario: el saldo lo
-- mantiene el trigger del movimiento (security definer), no la escritura directa.
CREATE POLICY "nutra_inventory_select" ON "nutraceutical_inventory"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint

-- === Trigger 1 (apply, AFTER INSERT en movimientos): recomputa el saldo cacheado como la suma de los
-- deltas. Es el UNICO escritor del saldo; el servicio nunca lo toca. security definer para escribir el
-- inventario pese a la RLS (que no da INSERT/UPDATE a usuarios). ===
create or replace function public.nutra_movement_apply() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
    where professional_id = NEW.professional_id and nutraceutical_id = NEW.nutraceutical_id;
  insert into public.nutraceutical_inventory (professional_id, nutraceutical_id, stock_quantity, last_updated)
    values (NEW.professional_id, NEW.nutraceutical_id, v_sum, now())
    on conflict (professional_id, nutraceutical_id)
    do update set stock_quantity = v_sum, last_updated = now();
  return null;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_movement_apply_trg ON nutraceutical_stock_movements;--> statement-breakpoint
CREATE TRIGGER nutra_movement_apply_trg
  AFTER INSERT ON nutraceutical_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.nutra_movement_apply();--> statement-breakpoint

-- === Trigger 2 (append_only, BEFORE UPDATE OR DELETE en movimientos): registro de custodia inmutable. ===
create or replace function public.nutra_movement_append_only() returns trigger
language plpgsql
as $$
begin
  raise exception 'nutraceutical_stock_movements es append-only (registro de custodia): un error se corrige con un movimiento inverso, no se edita ni se borra.';
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_movement_append_only_trg ON nutraceutical_stock_movements;--> statement-breakpoint
CREATE TRIGGER nutra_movement_append_only_trg
  BEFORE UPDATE OR DELETE ON nutraceutical_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.nutra_movement_append_only();--> statement-breakpoint

-- === Trigger 3 (coherence, BEFORE INSERT OR UPDATE en inventario): el saldo SOLO puede ser la suma de
-- los movimientos. El trigger 1 lo pone correcto; una escritura directa con otro valor (bug, o mano)
-- se rechaza. Detecta corrupcion silenciosa del cache. ===
create or replace function public.nutra_inventory_coherence() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
    where professional_id = NEW.professional_id and nutraceutical_id = NEW.nutraceutical_id;
  if NEW.stock_quantity is distinct from v_sum then
    raise exception 'nutraceutical_inventory.stock_quantity es un cache de la suma de movimientos (esperado %, intento %).', v_sum, NEW.stock_quantity;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_inventory_coherence_trg ON nutraceutical_inventory;--> statement-breakpoint
CREATE TRIGGER nutra_inventory_coherence_trg
  BEFORE INSERT OR UPDATE ON nutraceutical_inventory
  FOR EACH ROW EXECUTE FUNCTION public.nutra_inventory_coherence();
