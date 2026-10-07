-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS DOS ERRORES DE LOS ENLACES PUBLICOS: ¿SE PERDIO ALGO?  ·  SOLO LECTURA
--
-- ═══ LOS DOS EVENTOS (Sentry, 6 y 7 de octubre) ═══
--
--   a) 6 oct · TypeError: Failed to fetch · POST /consentimiento/QNZ2pfHt3zCZyglemBK-St0KH1m_CXAlIEDVt0XcjNM
--      Tras marcar la casilla de comunicaciones y pulsar enviar. La integrante reporto el error al paciente.
--
--   b) 7 oct · "An unexpected response was received from the server" · POST /encuesta/z50YPIb3tEZwWNZNaGT7HBh50_4CHW0V1SNTnHwaQYw [500]
--
-- ═══ LO QUE YA SE SABE SIN MIRAR LA BASE ═══
--
-- EL (b) ES NUESTRO. Ese mensaje lo pone REACT en el navegador cuando una server action recibe una respuesta
-- que no es de accion: o sea, el servidor devolvio un 500. El 500 es un throw NO CAPTURADO, porque las dos
-- acciones de la encuesta devuelven `Result` para todo error esperable.
--
-- Y FUE EL GUARDADO INTERMEDIO, no el envio final: las migas de Sentry muestran dos clics en una PILDORA
-- (`type="button"`, que no envia el formulario) y el autoguardado se dispara justo con el clic de la pildora
-- (`onClick={persistDiferido}`). Eso es buena noticia: lo que fallo es el guardado de avance, y las respuestas
-- siguen en el formulario del navegador mientras el paciente no cierre la pagina.
--
-- EL (a) PUEDE SER RED: "Failed to fetch" es el navegador que no logro llegar al servidor (familia del "Load
-- failed"). Pero hay que comprobar si el consentimiento quedo firmado o si ese paciente se quedo sin firmar.
--
-- ESTAS CONSULTAS CONTESTAN LO UNICO QUE NO SE PUEDE DEDUCIR: que quedo guardado.
--
-- NO IMPRIME PII: ni nombre, ni documento, ni correo. Solo conteos, estados y fechas.
--
-- COMO SE CORRE (contra la NUBE, en el SQL editor de Supabase):
--   psql "<cadena>" -f scripts/QUE_PASO_CON_ESOS_DOS_ENLACES_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) EL ENLACE DE LA ENCUESTA DEL 7 OCT: ¿cuantas respuestas tiene y de cuando? ───────────────
--
-- SI `respuestas` SALE EN 64 (o cerca) la encuesta se completo y el 500 fue solo un guardado intermedio que
-- se reintento. Si sale muy bajo o en cero, el paciente se quedo sin guardar y hay que volver a pedirsela.
select 'A · la encuesta del 7 oct'                      as consulta,
       sl.type                                          as tipo_de_enlace,
       sl.consumed_at is not null                       as enlace_consumido,
       e.id                                             as evaluacion,
       e.status                                         as estado,
       (e.created_at at time zone 'America/Bogota')     as creada,
       (e.updated_at at time zone 'America/Bogota')     as ultimo_cambio,
       (select count(*) from survey_responses sr
          join survey_answers sa on sa.response_id = sr.id
         where sr.evaluation_id = e.id)                 as respuestas
  from survey_links sl
  left join evaluations e on e.resume_token = sl.token or e.patient_id = sl.patient_id
 where sl.token = 'z50YPIb3tEZwWNZNaGT7HBh50_4CHW0V1SNTnHwaQYw';

-- ── (A2) Y SI EL ENLACE NO APUNTA A UNA EVALUACION, se busca por su paciente ─────────────────────
--
-- Un enlace de SEGUIMIENTO trae `patient_id` y la evaluacion se crea al usarlo, y si el 500 ocurrio antes el
-- enlace existe y la evaluacion no. Esta consulta lo distingue de "no existe el enlace".
select 'A2 · el enlace, sin su evaluacion'              as consulta,
       sl.type,
       sl.patient_id is not null                        as tiene_paciente,
       sl.consumed_at is not null                       as consumido,
       (sl.created_at at time zone 'America/Bogota')    as creado,
       (sl.expires_at at time zone 'America/Bogota')    as vence
  from survey_links sl
 where sl.token = 'z50YPIb3tEZwWNZNaGT7HBh50_4CHW0V1SNTnHwaQYw';

-- ── (B) EL ENLACE DEL CONSENTIMIENTO DEL 6 OCT: ¿quedo firmado? ──────────────────────────────────
--
-- LO QUE DECIDE ES SI HAY CONSENTIMIENTO: si el paciente de ese enlace tiene consentimientos vigentes con
-- fecha del 6 de octubre, firmo y el "Failed to fetch" fue el navegador perdiendo la respuesta DESPUES de que
-- el servidor ya habia guardado. Si no hay ninguno, se quedo sin firmar y hay que reenviarle el enlace.
select 'B · el consentimiento del 6 oct'                as consulta,
       sl.type                                          as tipo_de_enlace,
       sl.consumed_at is not null                        as enlace_consumido,
       e.status                                          as estado_de_la_evaluacion,
       (select count(*) from patient_consents pc
         where pc.patient_id = coalesce(sl.patient_id, e.patient_id)
           and pc.revoked_at is null)                    as consentimientos_vigentes,
       (select max(pc.signed_at at time zone 'America/Bogota') from patient_consents pc
         where pc.patient_id = coalesce(sl.patient_id, e.patient_id))
                                                         as ultima_firma
  from survey_links sl
  left join evaluations e on e.resume_token = sl.token or e.patient_id = sl.patient_id
 where sl.token = 'QNZ2pfHt3zCZyglemBK-St0KH1m_CXAlIEDVt0XcjNM';

-- ── (C) ¿HAY MAS ENLACES ABIERTOS QUE NUNCA SE USARON, de estos dias? ───────────────────────────
--
-- Para ver si el problema es de dos pacientes o de muchos. Un enlace vigente, sin usar y de hace varios dias
-- es un paciente que no completo, y hoy nadie lo persigue.
select 'C · enlaces sin usar de los ultimos 10 dias'    as consulta,
       sl.type,
       count(*)                                          as cuantos,
       min((sl.created_at at time zone 'America/Bogota')::date) as el_mas_viejo
  from survey_links sl
 where sl.consumed_at is null
   and sl.created_at > now() - interval '10 days'
 group by 1, 2
 order by 2;
