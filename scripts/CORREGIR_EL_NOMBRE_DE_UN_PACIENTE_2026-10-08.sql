-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CORREGIR EL NOMBRE DE UN PACIENTE  ·  ESCRIBE  ·  decision de Santiago, 2026-10-08
--
-- ═══ DE DONDE SALE ═══
--
-- Una paciente importada quedo con un typo al teclear su nombre ("Martinez carvjal"), y en Atlas NO EXISTE
-- ningun camino para corregirlo: la unica escritura sobre el perfil toca educacion, ocupacion y estrato.
-- Santiago lo decidio: "que admin lo corrija y listo. Es solo el nombre."
--
-- ═══ EL MATIZ QUE HAY QUE TENER PRESENTE AL CORRER ESTO ═══
--
-- El nombre TECLEADO al firmar quedo en el consentimiento (`patient_external_consents.typed_name`, y en
-- `patient_consents` el de Atlas). ESE NO SE TOCA, y es deliberado: la firma es un hecho historico (esta persona
-- escribio ESTO ese dia), mientras la identidad es un dato actual. Despues de corregir, el nombre mostrado y el
-- firmado pueden diferir, y es lo correcto.
--
-- POR ESO VA CON AUDITORIA Y NO COMO UN UPDATE SUELTO: es identidad en una historia clinica. Dentro de seis
-- meses, alguien que vea que el consentimiento dice un nombre y el perfil otro tiene que poder encontrar quien
-- lo corrigio, cuando y que decia antes.
--
-- SE HACE POR SCRIPT Y NO CON PANTALLA, por ahora: es un caso, y una pantalla para editar identidad necesita su
-- policy y su rastro pensados, no improvisados. Si aparecen varios, se construye.
--
-- ═══ COMO SE CORRE ═══
--
-- 1. PRIMERO EL ENSAYO (no cambia nada): deja el bloque de abajo comentado y corre solo la consulta (A).
-- 2. Comprueba que la fila es la que crees, mirando el documento.
-- 3. Rellena los TRES valores de (B) y descomenta el bloque.
--
--   psql "<cadena>" -f scripts/CORREGIR_EL_NOMBRE_DE_UN_PACIENTE_2026-10-08.sql
--
-- NO HACE FALTA MIGRACION: no cambia el esquema, corrige un dato.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) QUIEN ES, Y QUE DICE HOY ─────────────────────────────────────────────────────────────────
--
-- Se busca por el NOMBRE MAL ESCRITO porque es lo que se tiene a la vista. El documento que devuelve es lo que
-- confirma que es la persona correcta antes de escribir.
select 'A · asi esta hoy'                                                as consulta,
       pa.id                                                             as paciente,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.first_name                                                      as nombre,
       pp.last_name                                                       as apellido,
       -- EL NOMBRE FIRMADO, para verlo al lado: es el que NO se va a tocar.
       (select x.typed_name from patient_external_consents x
         where x.patient_id = pa.id and x.typed_name is not null limit 1)  as nombre_firmado_html
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
 where pp.last_name ilike '%carvjal%'
    or pp.first_name ilike '%carvjal%';

-- ── (B) LA CORRECCION, CON SU RASTRO ─────────────────────────────────────────────────────────────
--
-- DESCOMENTA Y RELLENA LOS TRES VALORES. Va en UNA transaccion con su evento de auditoria: si el audit falla,
-- el cambio no queda, y no puede existir una correccion de identidad sin rastro.
--
-- EL `actor_id` ES EL PROFILE DE QUIEN LO CORRIGE (Santiago), no un admin genérico: el audit responde QUIEN.

/*
begin;

-- Pon aqui los tres valores antes de correr.
\set paciente '00000000-0000-0000-0000-000000000000'
\set nombre   'Nombre'
\set apellido 'Apellido Correcto'
\set actor    '00000000-0000-0000-0000-000000000000'

-- EL VALOR VIEJO SE CAPTURA ANTES de escribirlo: despues del update ya no existe en ninguna parte, y es la
-- mitad del rastro que de verdad importa (que decia antes).
with viejo as (
  select pp.patient_id, pp.first_name, pp.last_name
    from patient_profiles pp
   where pp.patient_id = :'paciente'::uuid
),
cambio as (
  update patient_profiles pp
     set first_name = :'nombre',
         last_name  = :'apellido'
   where pp.patient_id = :'paciente'::uuid
  returning pp.patient_id
)
insert into clinical_audit_log (event, actor_id, actor_email, entity_type, entity_id, payload)
select 'patient.name_corrected',
       :'actor'::uuid,
       (select p.email from profiles p where p.id = :'actor'::uuid),
       'patient',
       v.patient_id::text,
       jsonb_build_object(
         'antes', jsonb_build_object('first_name', v.first_name, 'last_name', v.last_name),
         'despues', jsonb_build_object('first_name', :'nombre', 'last_name', :'apellido'),
         -- SE DICE QUE LA FIRMA NO SE TOCO, para que nadie tenga que deducirlo dentro de seis meses viendo
         -- que el consentimiento dice otro nombre.
         'firma_conservada', true,
         'motivo', 'typo al teclear el nombre en el consentimiento del HTML'
       )
  from viejo v, cambio c
 where c.patient_id = v.patient_id;

-- Comprueba el resultado ANTES de confirmar.
select pp.first_name, pp.last_name from patient_profiles pp where pp.patient_id = :'paciente'::uuid;

-- Si se ve bien: commit. Si no: rollback.
commit;
*/
