-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿HAY MAS EVALUACIONES IMPORTADAS VACIAS?  ·  SOLO LECTURA
--
-- ═══ DE DONDE SALE LA PREGUNTA ═══
--
-- La evaluacion del 21 de la paciente db3e5f71 resulto estar COMPLETAMENTE VACIA: importada del HTML, 0
-- respuestas de encuesta, 0 mediciones, 0 diagnosticos, 0 tratamientos. Y aun asi figuraba en su historia
-- clinica como una consulta, al lado de la real del 25.
--
-- SI EL HTML TRAJO VARIAS ASI, hay historias clinicas con consultas que nunca ocurrieron, y nadie las ve
-- hasta que alguien abre la ficha y se extraña. Esta consulta las lista para poder retirarlas de una.
--
-- ═══ QUE CUENTA COMO "VACIA", Y POR QUE NO ES OBVIO ═══
--
-- SIN RESPUESTAS DE ENCUESTA Y SIN MEDICION. No basta con "sin diagnostico": una importada sin diagnostico
-- pero CON las 64 respuestas es una consulta real que simplemente no se diagnostico en Atlas, y retirarla
-- seria borrar trabajo. Lo que delata a la del 21 es que no tiene NADA que un paciente hubiera hecho.
--
-- Y SE MIRA TAMBIEN EL CONSENTIMIENTO, que es el caso raro de esa paciente: el HTML dice que firmo el 21.
-- Firmar es un acto real aunque la consulta no haya ocurrido, asi que una vacia CON consentimiento no es un
-- error de importacion: es una persona que firmo y no vino.
--
-- NO IMPRIME PII: ids, tipo, estado, fechas y conteos.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/IMPORTADAS_VACIAS_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) EL CONTEO ─────────────────────────────────────────────────────────────────────────────────
select 'A · el conteo'                                                   as consulta,
       count(*)                                                          as importadas,
       count(*) filter (where e.retirada_at is not null)                 as ya_retiradas,
       count(*) filter (
         where e.retirada_at is null
           and not exists (select 1 from survey_responses sr
                             join survey_answers sa on sa.response_id = sr.id
                            where sr.evaluation_id = e.id)
           and not exists (select 1 from bis_measurements m where m.evaluation_id = e.id)
       )                                                                 as vacias_sin_retirar
  from evaluations e
 where e.import_batch_id is not null;

-- ── (B) LAS VACIAS, UNA POR UNA ───────────────────────────────────────────────────────────────────
--
-- `tiene_consentimiento` distingue los dos casos: una vacia CON consentimiento es alguien que firmo y no
-- vino (como la del 21), y una vacia SIN nada es una consulta que el HTML trajo sin contenido.
select 'B · las vacias'                                                  as consulta,
       e.id                                                              as evaluacion,
       e.patient_id                                                      as paciente,
       e.type                                                            as tipo,
       e.status                                                          as estado,
       (e.created_at at time zone 'America/Bogota')::date                as dia,
       exists (select 1 from patient_consents pc
                where pc.patient_id = e.patient_id and pc.revoked_at is null) as tiene_consentimiento,
       -- ¿EL PACIENTE TIENE OTRA EVALUACION CON CONTENIDO? Si la tiene, esta vacia es ruido en su historia;
       -- si es la UNICA que tiene, retirarla lo deja sin ninguna, y eso hay que mirarlo antes.
       (select count(*) from evaluations o
         where o.patient_id = e.patient_id and o.id <> e.id
           and exists (select 1 from survey_responses sr2
                         join survey_answers sa2 on sa2.response_id = sr2.id
                        where sr2.evaluation_id = o.id))                 as otras_con_encuesta
  from evaluations e
 where e.import_batch_id is not null
   and e.retirada_at is null
   and not exists (select 1 from survey_responses sr
                     join survey_answers sa on sa.response_id = sr.id
                    where sr.evaluation_id = e.id)
   and not exists (select 1 from bis_measurements m where m.evaluation_id = e.id)
 order by e.created_at;

-- ── (C) Y POR LOTE, para saber si fue un lote concreto ───────────────────────────────────────────
select 'C · por lote'                                                    as consulta,
       (b.imported_at at time zone 'America/Bogota')::date               as dia_del_lote,
       b.source_file_name                                                as archivo,
       count(*)                                                          as evaluaciones,
       count(*) filter (
         where not exists (select 1 from survey_responses sr
                             join survey_answers sa on sa.response_id = sr.id
                            where sr.evaluation_id = e.id)
           and not exists (select 1 from bis_measurements m where m.evaluation_id = e.id)
       )                                                                 as vacias
  from evaluations e
  join html_import_batches b on b.id = e.import_batch_id
 group by 1, 2, 3
 order by 2;
