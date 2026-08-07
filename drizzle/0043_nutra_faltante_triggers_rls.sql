-- T3b-3 ST1: caso de faltante de nutraceuticos (consignacion). 0042 creo las tablas + enums (DDL generado).
-- Esta migracion (hand-written; drizzle-kit no genera triggers ni RLS) pone las garantias, con la misma
-- rigurosidad que los movimientos de inventario (0040), porque un faltante tiene CONSECUENCIA ECONOMICA:
--   - Las TRANSICIONES son la FUENTE DE VERDAD (append-only, inmutables). Una reclasificacion es una
--     transicion nueva, no una edicion: queda el rastro de quien decidio que.
--   - El estado del caso (status, charge_status, justificacion) es un CACHE proyectado por trigger desde la
--     ultima transicion; no se escribe directo (coherencia por trigger).
--   - Los HECHOS SELLADOS del caso (cantidad, precio, fechas, producto) son write-once.
--   - La maquina de estados se valida en la BD: una transicion arranca donde el caso esta.
--   - El cargo se materializa (charge_status) SOLO al confirmar injustificado (dos personas: admin propone,
--     direccion confirma). "Atlas no cobra automatico" -> "ni un solo administrativo cobra solo".
-- RLS: el integrante dueño ve/abre/justifica lo suyo; CNV (admin/soporte/direccion) ve; admin/direccion
-- clasifican. Es dato COMERCIAL (CNV-integrante), no clinico. Reproducible (CREATE OR REPLACE + DROP IF EXISTS).

-- === RLS ===
ALTER TABLE "nutraceutical_faltante_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_transitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Casos: SELECT del dueño o de CNV (dato comercial). INSERT solo del dueño (la deteccion es su conteo). Sin
-- UPDATE/DELETE de usuario: el estado lo proyecta el trigger (security definer); los hechos son write-once.
CREATE POLICY "nutra_faltante_cases_select" ON "nutraceutical_faltante_cases"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint
CREATE POLICY "nutra_faltante_cases_insert" ON "nutraceutical_faltante_cases"
  FOR INSERT TO authenticated WITH CHECK (
    public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint

-- Transiciones: SELECT del dueño del caso o de CNV. INSERT del dueño (justifica lo suyo) o de admin/direccion
-- (clasifican). El ROL EXACTO por transicion (admin propone, direccion confirma) lo impone el service; la RLS
-- es defensa. Sin UPDATE/DELETE (append-only): el trigger lo bloquea aunque se llegue por otra via.
CREATE POLICY "nutra_faltante_trans_select" ON "nutraceutical_faltante_transitions"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile(
      (select c.professional_id from public.nutraceutical_faltante_cases c where c.id = case_id)
    )
  );--> statement-breakpoint
CREATE POLICY "nutra_faltante_trans_insert" ON "nutraceutical_faltante_transitions"
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role('admin') OR public.has_role('direccion')
    OR public.is_own_professional_profile(
      (select c.professional_id from public.nutraceutical_faltante_cases c where c.id = case_id)
    )
  );--> statement-breakpoint

-- === Trigger 1 (append_only, BEFORE UPDATE OR DELETE en transiciones): registro economico inmutable. ===
create or replace function public.nutra_faltante_transition_append_only() returns trigger
language plpgsql
as $$
begin
  raise exception 'nutraceutical_faltante_transitions es append-only: una reclasificacion se registra como transicion nueva, no se edita ni se borra.';
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_faltante_transition_append_only_trg ON nutraceutical_faltante_transitions;--> statement-breakpoint
CREATE TRIGGER nutra_faltante_transition_append_only_trg
  BEFORE UPDATE OR DELETE ON nutraceutical_faltante_transitions
  FOR EACH ROW EXECUTE FUNCTION public.nutra_faltante_transition_append_only();--> statement-breakpoint

-- === Trigger 2 (validez, BEFORE INSERT en transiciones): la transicion arranca DONDE ESTA el caso. La
-- primera (apertura) lleva from_status NULL; las demas, from_status = estado actual del caso. Evita
-- clasificar un caso ya cerrado o saltarse estados. ===
create or replace function public.nutra_faltante_transition_valid() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_current public.nutraceutical_faltante_status; v_count integer;
begin
  select status into v_current from public.nutraceutical_faltante_cases where id = NEW.case_id;
  if v_current is null then
    raise exception 'nutra_faltante: caso % inexistente.', NEW.case_id;
  end if;
  select count(*) into v_count from public.nutraceutical_faltante_transitions where case_id = NEW.case_id;
  if v_count = 0 then
    if NEW.from_status is not null then
      raise exception 'nutra_faltante: la transicion de apertura lleva from_status NULL.';
    end if;
  else
    if NEW.from_status is distinct from v_current then
      raise exception 'nutra_faltante: transicion invalida (from_status % pero el caso esta en %).', NEW.from_status, v_current;
    end if;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_faltante_transition_valid_trg ON nutraceutical_faltante_transitions;--> statement-breakpoint
CREATE TRIGGER nutra_faltante_transition_valid_trg
  BEFORE INSERT ON nutraceutical_faltante_transitions
  FOR EACH ROW EXECUTE FUNCTION public.nutra_faltante_transition_valid();--> statement-breakpoint

-- === Trigger 3 (proyeccion, AFTER INSERT en transiciones): el UNICO escritor del estado del caso. Proyecta
-- status, charge_status y (en la justificacion) categoria + referencia. security definer para escribir el
-- caso pese a la RLS (que no da UPDATE a usuarios). El cargo se materializa SOLO al llegar a injustificado. ===
create or replace function public.nutra_faltante_project() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.nutraceutical_faltante_cases
    set status = NEW.to_status,
        charge_status = case when NEW.to_status = 'injustificado' then 'pendiente_liquidacion'::public.nutraceutical_faltante_charge
                             else 'sin_cargo'::public.nutraceutical_faltante_charge end,
        justification_category = coalesce(NEW.justification_category, justification_category),
        justification_reference = coalesce(NEW.justification_reference, justification_reference)
    where id = NEW.case_id;
  return null;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_faltante_project_trg ON nutraceutical_faltante_transitions;--> statement-breakpoint
CREATE TRIGGER nutra_faltante_project_trg
  AFTER INSERT ON nutraceutical_faltante_transitions
  FOR EACH ROW EXECUTE FUNCTION public.nutra_faltante_project();--> statement-breakpoint

-- === Trigger 4 (coherencia + inmutabilidad del caso, BEFORE UPDATE): los HECHOS SELLADOS no cambian, y el
-- estado solo puede ser el que dicta la ultima transicion (el trigger 3 lo pone; una escritura directa con
-- otro valor se rechaza). Detecta corrupcion silenciosa del cache. ===
create or replace function public.nutra_faltante_case_coherence() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_last public.nutraceutical_faltante_status;
begin
  -- hechos sellados write-once
  if NEW.professional_id is distinct from OLD.professional_id
     or NEW.nutraceutical_id is distinct from OLD.nutraceutical_id
     or NEW.quantity is distinct from OLD.quantity
     or NEW.sealed_unit_price is distinct from OLD.sealed_unit_price
     or NEW.sealed_total is distinct from OLD.sealed_total
     or NEW.reported_at is distinct from OLD.reported_at
     or NEW.deadline_at is distinct from OLD.deadline_at then
    raise exception 'nutra_faltante: los hechos sellados del caso son inmutables (producto, cantidad, precio, fechas).';
  end if;
  -- el estado debe ser el de la ultima transicion
  select to_status into v_last from public.nutraceutical_faltante_transitions
    where case_id = NEW.id order by created_at desc, id desc limit 1;
  if v_last is not null and NEW.status is distinct from v_last then
    raise exception 'nutra_faltante: el status es un cache de la ultima transicion (esperado %, intento %).', v_last, NEW.status;
  end if;
  if NEW.status = 'injustificado' and NEW.charge_status = 'sin_cargo' then
    raise exception 'nutra_faltante: un caso injustificado no puede quedar sin cargo.';
  end if;
  if NEW.status <> 'injustificado' and NEW.charge_status <> 'sin_cargo' then
    raise exception 'nutra_faltante: solo un caso injustificado lleva cargo.';
  end if;
  return NEW;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_faltante_case_coherence_trg ON nutraceutical_faltante_cases;--> statement-breakpoint
CREATE TRIGGER nutra_faltante_case_coherence_trg
  BEFORE UPDATE ON nutraceutical_faltante_cases
  FOR EACH ROW EXECUTE FUNCTION public.nutra_faltante_case_coherence();
