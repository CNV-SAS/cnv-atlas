-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LAS TRES FECHAS IMPOSIBLES Y LA CEDULA EN EL PACIENTE EQUIVOCADO  ·  ESCRIBE  ·  2026-10-09
--
-- ═══ QUE ARREGLA, Y POR QUE VA POR SCRIPT ═══
--
-- Hoy no hay ninguna pantalla en Atlas para corregir la fecha de nacimiento ni el documento de un paciente.
-- Son datos de IDENTIDAD en una historia clinica, asi que una pantalla para eso necesita su policy y su
-- rastro pensados, no improvisados. Son cuatro filas: van por script, con auditoria, y si se vuelve rutina se
-- construye la pantalla.
--
-- ═══ LO QUE HAY QUE SABER ANTES DE CORRER EL BLOQUE (B) ═══
--
-- CAMBIAR EL DOCUMENTO NO TOCA EL CONSENTIMIENTO FIRMADO, y es deliberado: `patient_consents` guarda el
-- documento del REPRESENTANTE (no el del paciente), y el nombre tecleado al firmar vive en el consentimiento
-- como hecho historico. La historia clinica referencia al paciente por su id, no por su cedula, asi que nada
-- se descuelga al cambiarla.
--
-- LO QUE SI CAMBIA es que el documento viejo queda LIBRE, que es justo lo que se busca: la integrante no podia
-- crear a Andrea porque su cedula estaba ocupada por Juan Pablo.
--
-- ═══ Y LO QUE QUEDA PENDIENTE DESPUES DE (A), QUE NO LO HACE ESTE SCRIPT ═══
--
-- DOS DE LOS TRES PACIENTES YA TIENEN DIAGNOSTICO EMITIDO sobre la fecha mala, y la edad entra al motor.
-- Corregir la fecha NO rehace el diagnostico: el diagnostico esta sellado con los valores de ese dia.
--
-- PARA REHACERLO hay que pasar por el camino de CORRECCION de la evaluacion (el que regenera la cascada y
-- deja la vieja marcada como reemplazada), no por SQL. Lo hace el profesional desde la evaluacion, con su
-- motivo. Si se tocara el diagnostico por SQL quedaria un diagnostico que no corresponde a ninguna version.
--
-- COMO SE CORRE:
--   1. Corre solo las consultas de verificacion (sin descomentar nada) y comprueba que las filas son las que
--      crees, mirando documento y nombre.
--   2. Descomenta el bloque que quieras aplicar y vuelve a correr.
--   3. Mira el `select` final ANTES del commit. Si algo se ve mal, cambia `commit` por `rollback`.
--
--   psql "<cadena>" -f scripts/CORREGIR_TRES_FECHAS_Y_UNA_CEDULA_2026-10-09.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── VERIFICACION: asi estan las cuatro filas hoy ─────────────────────────────────────────────────
select 'asi estan hoy'                                                   as consulta,
       pa.id                                                             as paciente,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.first_name || ' ' || pp.last_name                               as nombre,
       pp.birth_date                                                      as fecha_de_nacimiento
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
 where pa.document_number in ('43597117', '43202057', '70696566', '42902851')
 order by 3;

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- (A) LAS TRES FECHAS.  Descomenta para aplicar.
--
-- Los valores los confirmo la integrante (Angela Marin), que es de quien son los tres pacientes:
--   CC 43597117 · ANGELA SOSSA            · 1795-02-21  ->  1975-02-21
--   CC 43202057 · Yuliana marcela Arenas  · 41980-04-19 ->  1980-04-19
--   CC 70696566 · german patiño           · 51977-02-08 ->  1977-05-28   (ojo: cambia el MES, no solo el año)
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

/*
begin;

-- EL VALOR VIEJO SE CAPTURA ANTES DE ESCRIBIRLO: despues no existe en ninguna parte, y es la mitad del
-- rastro que de verdad importa (que decia antes). Por eso el update y el audit van en la misma sentencia.
with objetivo(documento, nueva) as (
  values ('43597117', date '1975-02-21'),
         ('43202057', date '1980-04-19'),
         ('70696566', date '1977-05-28')
),
viejo as (
  select pa.id as patient_id, pa.document_number, pp.birth_date as antes, o.nueva
    from patients pa
    join patient_profiles pp on pp.patient_id = pa.id
    join objetivo o on o.documento = pa.document_number
),
cambio as (
  update patient_profiles pp
     set birth_date = v.nueva
    from viejo v
   where pp.patient_id = v.patient_id
  returning pp.patient_id
)
insert into clinical_audit_log (event, actor_id, actor_email, entity_type, entity_id, payload)
select 'patient.birth_date_corrected',
       null,
       'correccion operativa (Santiago)',
       'patient',
       v.patient_id::text,
       jsonb_build_object(
         'antes', v.antes,
         'despues', v.nueva,
         'confirmado_por', 'la integrante que atiende al paciente',
         -- SE DEJA DICHO QUE EL DIAGNOSTICO NO SE TOCO, para que dentro de seis meses nadie tenga que
         -- deducir por que un diagnostico viejo no cuadra con la edad actual del paciente.
         'diagnostico_no_rehecho', true,
         'motivo', 'fecha imposible detectada en el barrido del 2026-10-08'
       )
  from viejo v
  join cambio c on c.patient_id = v.patient_id;

select pa.document_number, pp.birth_date
  from patients pa join patient_profiles pp on pp.patient_id = pa.id
 where pa.document_number in ('43597117', '43202057', '70696566');

commit;
*/

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- (B) LA CEDULA DE JUAN PABLO.  Descomenta para aplicar.
--
-- Quedo con 42902851, que es la de Andrea, y por eso la integrante no podia crear a Andrea: el unique de
-- documento por organizacion la bloqueo, CORRECTAMENTE. La suya es 15446676.
--
-- SE COMPRUEBA ANTES QUE 15446676 ESTE LIBRE: si ya existiera otro paciente con ella, este update reventaria
-- contra el unique, y conviene saberlo antes y no por el error de la base.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

select 'esta libre la cedula nueva?'                                     as consulta,
       count(*)                                                          as ya_la_tiene_alguien
  from patients where document_number = '15446676';

/*
begin;

with viejo as (
  select pa.id as patient_id, pa.document_number as antes, pp.first_name || ' ' || pp.last_name as nombre
    from patients pa
    join patient_profiles pp on pp.patient_id = pa.id
   where pa.document_number = '42902851'
),
cambio as (
  update patients pa
     set document_number = '15446676'
    from viejo v
   where pa.id = v.patient_id
  returning pa.id
)
insert into clinical_audit_log (event, actor_id, actor_email, entity_type, entity_id, payload)
select 'patient.document_corrected',
       null,
       'correccion operativa (Santiago)',
       'patient',
       v.patient_id::text,
       jsonb_build_object(
         'antes', v.antes,
         'despues', '15446676',
         'nombre', v.nombre,
         -- EL CONSENTIMIENTO NO SE TOCA: guarda el documento del REPRESENTANTE, no el del paciente, y el
         -- nombre tecleado al firmar es un hecho historico. La historia clinica cuelga del id, no de la cedula.
         'consentimiento_intacto', true,
         'motivo', 'la cedula pertenecia a otra paciente (Andrea), que no se podia crear por el duplicado'
       )
  from viejo v
  join cambio c on c.id = v.patient_id;

select pa.document_number, pp.first_name, pp.last_name
  from patients pa join patient_profiles pp on pp.patient_id = pa.id
 where pa.document_number in ('15446676', '42902851');

commit;
*/
