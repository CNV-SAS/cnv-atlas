-- Remesa / consignación CNV → integrante (E2, núcleo). 0051 agregó la columna `remesa_id` (auto-FK).
-- Esta migración (hand-written: drizzle-kit no genera triggers/RLS/checks) pone las garantías:
--   1. El saldo EXCLUYE type=remesa. Una remesa DECLARA un envío, no mueve el inventario del integrante:
--      el saldo sube cuando ÉL confirma la recepción, no cuando CNV declara. Sin esto el saldo subiría dos
--      veces (la remesa + la recepción). Toca los DOS triggers que suman deltas (apply y coherence).
--   2. RLS de INSERT: la REMESA la registra admin/soporte (CNV envía); el resto de movimientos
--      (recepción/despacho/conciliación/devolución) el profesional dueño. El profesional NO declara remesas.
--   3. `remesa_id` solo en una recepción (CHECK), y debe apuntar a una remesa del MISMO integrante y
--      producto (trigger de coherencia). `remesa_id` NULL en una recepción = NO respaldada = discrepancia
--      visible (no se bloquea: se permite, se avisa, no se oculta).
-- Reproducible (CREATE OR REPLACE + DROP IF EXISTS).

-- === 1. `remesa_id` solo aplica a una recepción ===
ALTER TABLE "nutraceutical_stock_movements"
  ADD CONSTRAINT "nutra_movements_remesa_id_only_recepcion"
  CHECK (remesa_id IS NULL OR type = 'recepcion');--> statement-breakpoint

-- === 2. El saldo EXCLUYE type=remesa (apply): recomputa la suma SIN las remesas. ===
create or replace function public.nutra_movement_apply() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
    where professional_id = NEW.professional_id and nutraceutical_id = NEW.nutraceutical_id
      and type <> 'remesa';
  insert into public.nutraceutical_inventory (professional_id, nutraceutical_id, stock_quantity, last_updated)
    values (NEW.professional_id, NEW.nutraceutical_id, v_sum, now())
    on conflict (professional_id, nutraceutical_id)
    do update set stock_quantity = v_sum, last_updated = now();
  return null;
end;
$$;--> statement-breakpoint

-- === 3. El cache de coherencia también excluye type=remesa (debe cuadrar con el apply). ===
create or replace function public.nutra_inventory_coherence() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
    where professional_id = NEW.professional_id and nutraceutical_id = NEW.nutraceutical_id
      and type <> 'remesa';
  if NEW.stock_quantity is distinct from v_sum then
    raise exception 'nutraceutical_inventory.stock_quantity es un cache de la suma de movimientos no-remesa (esperado %, intento %).', v_sum, NEW.stock_quantity;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint

-- === 4. RLS de INSERT: remesa = admin/soporte; el resto = el profesional dueño. ===
DROP POLICY IF EXISTS "nutra_movements_insert" ON "nutraceutical_stock_movements";--> statement-breakpoint
CREATE POLICY "nutra_movements_insert" ON "nutraceutical_stock_movements"
  FOR INSERT TO authenticated WITH CHECK (
    (type = 'remesa' AND (public.has_role('admin') OR public.has_role('soporte')))
    OR (type <> 'remesa' AND public.is_own_professional_profile(professional_id))
  );--> statement-breakpoint

-- === 5. Coherencia del vínculo: una recepción con remesa_id debe respaldarse con una remesa del MISMO
--         integrante y producto. La recepción SIN remesa se permite (queda no respaldada, discrepancia). ===
create or replace function public.nutra_movement_remesa_link() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_prof uuid; v_nutra uuid; v_type public.nutraceutical_movement_type;
begin
  if NEW.remesa_id is not null then
    select professional_id, nutraceutical_id, type into v_prof, v_nutra, v_type
      from public.nutraceutical_stock_movements where id = NEW.remesa_id;
    if v_type is distinct from 'remesa' then
      raise exception 'remesa_id debe apuntar a un movimiento type=remesa.';
    end if;
    if v_prof is distinct from NEW.professional_id or v_nutra is distinct from NEW.nutraceutical_id then
      raise exception 'la recepción debe respaldarse con una remesa del mismo integrante y producto.';
    end if;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_movement_remesa_link_trg ON nutraceutical_stock_movements;--> statement-breakpoint
CREATE TRIGGER nutra_movement_remesa_link_trg
  BEFORE INSERT ON nutraceutical_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.nutra_movement_remesa_link();
