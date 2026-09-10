-- LAS EMISIONES DE LA PRESCRIPCION: separar EMITIR de BLOQUEAR (Santiago, 2026-09-09).
--
-- EL PROBLEMA QUE RESUELVE, verificado en el codigo antes de proponer nada. El plan impreso, el plan que
-- viaja al correo y la HISTORIA CLINICA se arman los tres del protocolo VIVO: `protocol_suggested` mas los
-- `adj_*` de hoy, recomputados por `computeProtocoloEfectivo` en el momento de leer. Ninguno lee
-- `protocol_approved`. O sea que esos tres documentos son estables SOLO porque el trigger 0026 congela los
-- `adj_*` al aprobar. Sin ese congelado, la historia clinica de una consulta de agosto diria lo que los
-- ajustes digan hoy: un documento clinico que cambia retroactivamente.
--
-- POR QUE NO SE ARREGLA CONGELANDO MAS. Congelar es lo que estorba: obliga a un boton que parece un
-- tramite ("Entregado en consulta"), bloquea la prescripcion y exige reabrir con motivo para corregir una
-- coma. Santiago lo reporto como confuso y tiene razon: son tres cosas que el profesional sufre para
-- conseguir UNA que si importa, saber que recibio el paciente.
--
-- LA SEPARACION. Hoy aprobar hace dos cosas pegadas: SELLA y CIERRA. Se parten:
--   · La prescripcion queda SIEMPRE ABIERTA. Sin boton de aprobar, sin bloqueo, sin reapertura con motivo.
--   · Cada vez que se EMITE (se imprime para entregar, o se envia por correo) se guarda una COPIA
--     INMUTABLE de lo que salio, con su fecha, su via y quien la emitio. Es un REGISTRO, no un candado: no
--     impide seguir editando.
--   · La historia clinica lee LAS EMISIONES, no el estado vivo.
--
-- Y ESTO NO CONTRADICE A GILDARDO, LO CUMPLE MEJOR. Su §6c, textual: "EL SELLADO NO ES UN CANDADO: ES UNA
-- CONSECUENCIA REGISTRADA. Un profesional que necesita corregir un plan aprobado tiene que poder hacerlo;
-- lo que no puede es que el cambio no deje rastro ni le llegue al paciente que ya se lo llevo." Con
-- emisiones, corregir no necesita permiso y el rastro no se puede omitir.
--
-- POR QUE UNA TABLA Y NO UNA COLUMNA. Son VARIAS por evaluacion a proposito: se imprime, se corrige, se
-- vuelve a imprimir, se envia. Cada salida es un hecho distinto y el paciente puede tener dos papeles.
--
-- Y POR QUE NO EL AUDIT LOG, aunque el acto tambien se audite: `clinical_audit_log` es admin-only para
-- SELECT, asi que el profesional no podria ver que le entrego a su propio paciente. Es la misma razon por
-- la que existen `treatment_approvals` y `hc_deliveries`. Un almacen se elige por TODAS sus propiedades, y
-- la de LECTURA es la que se olvida.

do $$
declare
  n_tratamientos int;
  n_aprobados int;
  n_historicos int;
  n_emisiones int;
begin
  select count(*) into n_tratamientos from treatments;
  select count(*) into n_aprobados from treatments where status = 'approved';
  select count(*) into n_historicos from treatment_approvals;
  select count(*) into n_emisiones from information_schema.tables
    where table_schema = 'public' and table_name = 'prescription_emissions';
  raise notice 'ANTES: % tratamientos, % aprobados, % aprobaciones historicas, tabla de emisiones existe = %',
    n_tratamientos, n_aprobados, n_historicos, (n_emisiones > 0);
end $$;--> statement-breakpoint

create table if not exists prescription_emissions (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  -- TAMBIEN LA EVALUACION, y no es redundancia por comodidad: la historia clinica y el plan se leen POR
  -- EVALUACION, y encadenar treatments -> diagnoses -> evaluations en cada lectura de un documento
  -- clinico es justo donde un join de mas se convierte en un bloque que falta.
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  -- QUE SALIO: la prescripcion efectiva tal cual, con la misma forma que `treatments.protocol_approved`
  -- (peso efectivo, cadena calorica, ajustes aplicados, fenotipo, estrategia, restricciones, examenes y
  -- las versiones del motor). Es una COPIA, no una referencia: el sentido entero de la tabla es que lo
  -- emitido no dependa de nada que se pueda mover despues.
  prescripcion jsonb not null,
  -- La cadena efectiva sellada aparte, para listarla sin abrir el jsonb. MISMOS tipos que en `treatments`
  -- (integer los dos): copiar no puede convertir, o el registro diria otro numero.
  kcal_objetivo integer,
  proteina_g integer,
  -- POR DONDE SALIO. 'impresa' (se imprimio para entregarla en consulta) o 'correo' (viajo en el reporte).
  -- Texto y no enum para no pagar un `ALTER TYPE ... ADD VALUE` (que no corre dentro de una transaccion)
  -- el dia que haya una tercera via. Ver el check de mas abajo.
  via text not null,
  -- QUIEN Y CUANDO. Nullable a proposito: el backfill trae prescripciones aprobadas ANTES de que las
  -- emisiones existieran, y algunas no tienen `approved_by`. Inventarles un autor seria peor que
  -- declararlo vacio. Para toda emision nueva el writer los exige. RESTRICT (regla 14).
  emitted_by uuid references profiles(id) on delete restrict,
  emitted_by_email text,
  emitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint prescription_emissions_via_check
    check (via in ('impresa', 'correo', 'anterior'))
);--> statement-breakpoint

comment on table prescription_emissions is
  'Copia inmutable de cada prescripcion que SALIO hacia el paciente (impresa o por correo). Es un registro, no un candado: la prescripcion sigue editandose. La historia clinica lee de aqui, no del estado vivo, para que un documento de agosto no diga lo que los ajustes digan hoy.';--> statement-breakpoint

comment on column prescription_emissions.via is
  'impresa | correo | anterior. "anterior" son las aprobadas antes de que existieran las emisiones: se migran como emitidas con su fecha, pero su via no se registro y no se inventa.';--> statement-breakpoint

create index if not exists prescription_emissions_evaluation_idx
  on prescription_emissions (evaluation_id, emitted_at desc);--> statement-breakpoint

create index if not exists prescription_emissions_treatment_idx
  on prescription_emissions (treatment_id, emitted_at desc);--> statement-breakpoint

-- INMUTABLE POR TRIGGER, no por convencion. La tabla existe para poder decir que recibio el paciente; una
-- fila editable no prueba nada. Append-only: solo INSERT.
--
-- VIA DE ESCAPE (misma acotacion que el resto de los triggers de inmutabilidad, ver ARCHITECTURE.md):
-- SET LOCAL session_replication_role = replica dentro de una transaccion desactiva tambien este. Limite
-- innegociable: SOLO demo/pre-produccion, sin registros clinicos reales.
create or replace function prescription_emissions_immutability() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Una emision no se borra: es la constancia de lo que recibio el paciente.';
  end if;
  raise exception 'Una emision no se modifica: si la prescripcion cambio, se emite otra vez.';
end;
$$ language plpgsql;--> statement-breakpoint

drop trigger if exists prescription_emissions_immutability_trg on prescription_emissions;--> statement-breakpoint

create trigger prescription_emissions_immutability_trg
  before update or delete on prescription_emissions
  for each row execute function prescription_emissions_immutability();--> statement-breakpoint

alter table prescription_emissions enable row level security;--> statement-breakpoint

-- Misma visibilidad que el resto de las hijas de treatments: si el profesional puede ver al paciente,
-- puede ver que se le entrego. Es justo lo que la tabla existe para permitir.
drop policy if exists "prescription_emissions_select" on public.prescription_emissions;--> statement-breakpoint

create policy "prescription_emissions_select" on public.prescription_emissions
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.treatments t
      join public.diagnoses d on d.id = t.diagnosis_id
      join public.evaluations e on e.id = d.evaluation_id
      where t.id = prescription_emissions.treatment_id
        and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- Sin policy de escritura por sesion: las emisiones las escribe el servicio con service role dentro de la
-- transaccion que tambien deja el evento en clinical_audit_log (regla dura 8).

-- ═══ BACKFILL ═══
--
-- CUIDADO (b) DE SANTIAGO: "las 2 aprobadas migran como emitidas, con su fecha".
--
-- SE MIGRAN LAS DOS FUENTES, y las dos son "lo que el paciente recibio":
--   1. Las prescripciones APROBADAS hoy vigentes (`treatments.protocol_approved`).
--   2. Las aprobaciones ANTERIORES que se movieron a `treatment_approvals` al reabrir. Esas tambien
--      salieron hacia alguien; dejarlas fuera borraria del sistema el papel que esa persona tiene.
--
-- LA VIA SE LEE, NO SE SUPONE. `protocol_approved->>'aprobadoVia'` la trae desde el 2026-09-09 ('envio' o
-- 'entrega_en_consulta'); antes de esa fecha no existia el campo, y esas filas quedan como 'anterior'. Una
-- via inventada seria peor que una via ausente: la tabla se lee para contestar por donde salio.
--
-- IDEMPOTENTE POR `not exists`, no por un indice unico. Un unico sobre (treatment_id, emitted_at) tambien
-- serviria, pero pondria una restriccion permanente sobre las emisiones REALES por una necesidad que es
-- solo del backfill. La condicion del backfill se escribe en el backfill.
insert into prescription_emissions (
  treatment_id, evaluation_id, prescripcion, kcal_objetivo, proteina_g, via,
  emitted_by, emitted_by_email, emitted_at
)
select
  t.id,
  e.id,
  t.protocol_approved,
  t.kcal_objetivo,
  t.proteina_g,
  case t.protocol_approved->>'aprobadoVia'
    when 'envio' then 'correo'
    when 'entrega_en_consulta' then 'impresa'
    else 'anterior'
  end,
  t.approved_by,
  p.email,
  t.approved_at
from treatments t
join diagnoses d on d.id = t.diagnosis_id
join evaluations e on e.id = d.evaluation_id
left join profiles p on p.id = t.approved_by
where t.status = 'approved'
  and t.protocol_approved is not null
  and t.approved_at is not null
  and not exists (
    select 1 from prescription_emissions pe
    where pe.treatment_id = t.id and pe.emitted_at = t.approved_at
  );--> statement-breakpoint

insert into prescription_emissions (
  treatment_id, evaluation_id, prescripcion, kcal_objetivo, proteina_g, via,
  emitted_by, emitted_by_email, emitted_at
)
select
  ta.treatment_id,
  e.id,
  ta.protocol_approved,
  ta.kcal_objetivo,
  ta.proteina_g,
  case ta.protocol_approved->>'aprobadoVia'
    when 'envio' then 'correo'
    when 'entrega_en_consulta' then 'impresa'
    else 'anterior'
  end,
  ta.approved_by,
  p.email,
  ta.approved_at
from treatment_approvals ta
join treatments t on t.id = ta.treatment_id
join diagnoses d on d.id = t.diagnosis_id
join evaluations e on e.id = d.evaluation_id
left join profiles p on p.id = ta.approved_by
where not exists (
  select 1 from prescription_emissions pe
  where pe.treatment_id = ta.treatment_id and pe.emitted_at = ta.approved_at
);--> statement-breakpoint

do $$
declare
  n_emisiones int;
  n_impresas int;
  n_correo int;
  n_anteriores int;
begin
  select count(*) into n_emisiones from prescription_emissions;
  select count(*) into n_impresas from prescription_emissions where via = 'impresa';
  select count(*) into n_correo from prescription_emissions where via = 'correo';
  select count(*) into n_anteriores from prescription_emissions where via = 'anterior';
  raise notice 'DESPUES: % emisiones (% impresas, % por correo, % sin via registrada)',
    n_emisiones, n_impresas, n_correo, n_anteriores;
end $$;
