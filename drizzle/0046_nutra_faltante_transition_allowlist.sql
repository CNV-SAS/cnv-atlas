-- T3b-3 ST4: endurece la validez de las transiciones del faltante. La version de 0043 solo exigia que la
-- transicion arrancara donde estaba el caso (from_status = estado actual), pero NO restringia el destino:
-- un en_revision -> injustificado directo pasaba, saltandose la confirmacion de direccion. Esta migracion
-- agrega la LISTA DE TRANSICIONES PERMITIDAS, de modo que 'injustificado' SOLO es alcanzable desde
-- 'injustificado_pendiente'. Asi el requisito de dos personas (admin propone, direccion confirma) deja de
-- ser disciplina del service y pasa a ser IMPOSIBILIDAD en la BD, como superseded_at. Reproducible.

create or replace function public.nutra_faltante_transition_valid() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_current public.nutraceutical_faltante_status; v_count integer; v_ok boolean;
begin
  select status into v_current from public.nutraceutical_faltante_cases where id = NEW.case_id;
  if v_current is null then
    raise exception 'nutra_faltante: caso % inexistente.', NEW.case_id;
  end if;
  select count(*) into v_count from public.nutraceutical_faltante_transitions where case_id = NEW.case_id;
  if v_count = 0 then
    if NEW.from_status is not null or NEW.to_status <> 'reportado' then
      raise exception 'nutra_faltante: la transicion de apertura va de NULL a reportado.';
    end if;
    return NEW;
  end if;

  -- from_status debe ser el estado actual del caso.
  if NEW.from_status is distinct from v_current then
    raise exception 'nutra_faltante: transicion invalida (from_status % pero el caso esta en %).', NEW.from_status, v_current;
  end if;

  -- Lista de transiciones permitidas. injustificado SOLO desde injustificado_pendiente (gate de dos personas).
  v_ok := (NEW.from_status, NEW.to_status) in (
    ('reportado', 'en_revision'),
    ('reportado', 'injustificado_pendiente'),
    ('en_revision', 'justificado'),
    ('en_revision', 'venta_no_registrada'),
    ('en_revision', 'injustificado_pendiente'),
    ('injustificado_pendiente', 'injustificado'),
    ('injustificado_pendiente', 'justificado')
  );
  if not v_ok then
    raise exception 'nutra_faltante: transicion no permitida (% -> %).', NEW.from_status, NEW.to_status;
  end if;
  return NEW;
end;
$$;
