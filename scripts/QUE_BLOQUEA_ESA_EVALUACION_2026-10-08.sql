-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿QUE BLOQUEA EXACTAMENTE LA EVALUACION 22006cc1, Y CUANTAS MAS?  ·  SOLO LECTURA
--
-- ═══ POR QUE HACE FALTA ANTES DE ESCRIBIRLE A LEGAL ═══
--
-- La consulta anterior devolvio algo que NO encaja con el bloqueo, y conviene mirarlo antes de pedirle a legal
-- una excepcion sobre una premisa equivocada:
--
--   · `en_borrador_bloqueadas = 0`. Las 11 evaluaciones de menores importadas estan en `in_progress` (una
--     `completed`), o sea que su identidad YA SE CONFIRMO y el muro del consentimiento YA LAS DEJO PASAR.
--   · Y la que Santiago vio bloqueada (22006cc1-d08d-439f-95a3-62e2040c1275) NO APARECE en esa lista de 11.
--
-- SI LAS 11 NO ESTAN BLOQUEADAS, la excepcion que legal tendria que aprobar no es la que parecia: lo bloqueado
-- seria UNA evaluacion distinta (probablemente un SEGUIMIENTO nuevo abierto en Atlas), y el remedio puede ser
-- otro. Preguntarle a legal "¿damos luz verde a 11 menores?" cuando los 11 ya pasaron seria pedir permiso para
-- algo que ya ocurrio, y no pedirlo para lo que de verdad esta trabado.
--
-- ESTA CONSULTA LO ACLARA. No cambia nada: solo mira.
--
-- NO IMPRIME NOMBRES.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/QUE_BLOQUEA_ESA_EVALUACION_2026-10-08.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) ESA EVALUACION, CON TODO LO QUE EL MURO MIRA ──────────────────────────────────────────────
select 'A · la evaluacion de Santiago'                                   as consulta,
       e.id                                                              as evaluacion,
       e.status                                                          as estado,
       e.import_batch_id is not null                                      as es_importada,
       pp.birth_date                                                      as fecha_de_nacimiento,
       date_part('year', age(pp.birth_date))::int                        as edad_hoy,
       -- LAS DOS COSAS QUE DECIDEN la rama: si hay consentimiento de representante vigente, y si hay alguno.
       exists (select 1 from patient_consents pc
                where pc.patient_id = e.patient_id
                  and pc.consent_type = 'representante_legal' and pc.revoked_at is null) as tiene_representante,
       (select count(*) from patient_consents pc where pc.patient_id = e.patient_id)     as consents_atlas,
       (select string_agg(distinct pc.consent_type, ', ')
          from patient_consents pc where pc.patient_id = e.patient_id and pc.revoked_at is null) as tipos_vigentes,
       exists (select 1 from patient_external_consents x where x.patient_id = e.patient_id) as tiene_consent_html
  from evaluations e
  join patient_profiles pp on pp.patient_id = e.patient_id
 where e.id = '22006cc1-d08d-439f-95a3-62e2040c1275';

-- ── (B) TODAS LAS QUE EL MURO BLOQUEA HOY, importadas o no ───────────────────────────────────────
--
-- Esta es la lista que de verdad importa: `draft` + menor + sin representante. Si sale vacia, nada esta
-- bloqueado y el caso de Santiago es otro (lo dira la consulta A).
select 'B · bloqueadas de verdad'                                        as consulta,
       e.id                                                              as evaluacion,
       e.patient_id                                                      as paciente,
       e.import_batch_id is not null                                      as es_importada,
       date_part('year', age(pp.birth_date))::int                        as edad_hoy,
       (e.created_at at time zone 'America/Bogota')::date                as dia
  from evaluations e
  join patient_profiles pp on pp.patient_id = e.patient_id
 where e.status = 'draft'
   and pp.birth_date is not null
   and date_part('year', age(pp.birth_date)) < 18
   and not exists (select 1 from patient_consents pc
                    where pc.patient_id = e.patient_id
                      and pc.consent_type = 'representante_legal' and pc.revoked_at is null)
 order by 5, 6;

-- ── (C) LAS FECHAS DE NACIMIENTO IMPOSIBLES ──────────────────────────────────────────────────────
--
-- En la consulta anterior salio una fila con `edad_hoy = -49950`: esa fecha esta en el ano 51.976 o parecido.
-- NO ES UN MENOR, es un dato roto, y no es cosmetico: LA EDAD ENTRA AL MOTOR (clasificadores por edad, el
-- fenotipo de sarcopenia), asi que un diagnostico sobre esa fecha es un diagnostico sobre un dato imposible.
--
-- SE BARREN LAS DOS DIRECCIONES y no solo la del futuro: una fecha de 1850 tambien es imposible y tambien
-- entraria al motor. El rango se pone ANCHO a proposito (CLAUDE.md: si no hay fuente, que solo atrape lo
-- IMPOSIBLE, nunca lo improbable): nadie vivo nacio antes de 1900 ni despues de hoy.
select 'C · fechas de nacimiento imposibles'                             as consulta,
       pa.id                                                             as paciente,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.birth_date                                                      as fecha_de_nacimiento,
       date_part('year', age(pp.birth_date))::int                        as edad_calculada,
       pa.id in (select patient_id from evaluations where import_batch_id is not null) as es_importado,
       (select count(*) from evaluations e2 where e2.patient_id = pa.id)  as evaluaciones,
       (select count(*) from diagnoses d
          join evaluations e3 on e3.id = d.evaluation_id
         where e3.patient_id = pa.id)                                     as diagnosticos_ya_emitidos
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
 where pp.birth_date is not null
   and (pp.birth_date > current_date or pp.birth_date < date '1900-01-01')
 order by 4;
