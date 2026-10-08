-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS MENORES IMPORTADOS QUE QUEDARON BLOQUEADOS  ·  SOLO LECTURA
--
-- ═══ DE DONDE SALE ═══
--
-- Santiago abrio la evaluacion 22006cc1-d08d-439f-95a3-62e2040c1275 y salio:
--   "El documento indica que el paciente es menor de edad, pero el consentimiento se otorgo como mayor de
--    edad. Repite el consentimiento con el representante legal antes de confirmar."
-- Y la evaluacion queda en borrador: no se puede importar la medicion ni generar el diagnostico.
--
-- ═══ EL MECANISMO, VERIFICADO EN EL CODIGO ═══
--
-- `confirmEvaluationIdentity` decide la rama del consentimiento asi: hay un `patient_consents` de tipo
-- `representante_legal` vigente, o no lo hay. Si no lo hay, da por hecho que se consintio como MAYOR.
--
-- Y EL IMPORTADOR NUNCA ESCRIBE EN `patient_consents`: deja el consentimiento del HTML en
-- `patient_external_consents` a proposito (su comentario lo dice: "Nunca en patient_consents: esa es la del
-- gate de la regla dura 15"). Asi que para un paciente importado NO HAY NINGUNA rama usada, y el chequeo lee la
-- AUSENCIA como "rama mayor".
--
-- O SEA QUE NO ES QUE ATLAS SEA MAS ESTRICTO QUE EL HTML EN ESTE PUNTO: es que la pregunta "¿que rama se uso?"
-- no tiene respuesta para esta poblacion, y el chequeo contesta la peor de las dos.
--
-- ═══ Y AUN ASI EL GUARD TIENE RAZON DE FONDO ═══
--
-- El consentimiento del HTML no tenia rama de menor: se otorgaba igual para todos. Asi que para un paciente
-- menor ese consentimiento se otorgo SIN representante legal, y eso no es un detalle de formato. Lo que el
-- mensaje dice ("repite el consentimiento con el representante legal") es exactamente lo que hace falta.
--
-- LO QUE FALTA ES LA SALIDA EN LA PANTALLA, no el permiso: el camino EXISTE (si el representante firma un
-- consentimiento en Atlas, aparece el `representante_legal` y la evaluacion importada se confirma sola), y el
-- mensaje no lo nombra. Decir "repite el consentimiento" sin decir como es un callejon.
--
-- ESTA CONSULTA MIDE EL TAMANO DEL PROBLEMA, que es lo que falta para decidir.
--
-- NO IMPRIME NOMBRES: ids, edad y fechas.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/CUANTOS_MENORES_IMPORTADOS_BLOQUEADOS_2026-10-08.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) EL CONTEO ─────────────────────────────────────────────────────────────────────────────────
select 'A · el conteo'                                                   as consulta,
       count(*)                                                          as menores_importados,
       count(*) filter (where e.status = 'draft')                        as en_borrador_bloqueadas,
       count(distinct e.patient_id)                                      as pacientes_distintos
  from evaluations e
  join patients pa on pa.id = e.patient_id
  join patient_profiles pp on pp.patient_id = pa.id
 where e.import_batch_id is not null
   and pp.birth_date is not null
   -- MENOR HOY, que es cuando el chequeo corre: alguien importado siendo menor pudo cumplir 18 desde entonces
   -- y ya no estaria bloqueado. Contar por la edad al importar daria un numero que no es el del bloqueo.
   and (date_part('year', age(pp.birth_date)) < 18)
   and not exists (
     select 1 from patient_consents pc
      where pc.patient_id = pa.id and pc.consent_type = 'representante_legal' and pc.revoked_at is null
   );

-- ── (B) UNA POR UNA, para poder trabajarlas ──────────────────────────────────────────────────────
select 'B · las bloqueadas'                                              as consulta,
       e.id                                                              as evaluacion,
       e.patient_id                                                      as paciente,
       e.status                                                          as estado,
       date_part('year', age(pp.birth_date))::int                        as edad_hoy,
       (e.created_at at time zone 'America/Bogota')::date                as dia_de_la_evaluacion,
       -- ¿TIENE EL CONSENTIMIENTO DEL HTML? Si lo tiene, hubo una firma real (sin rama de menor); si no, la
       -- consulta se importo sin firma, que es otro caso y se resuelve igual pero conviene distinguirlo.
       exists (select 1 from patient_external_consents x where x.patient_id = pa.id) as tiene_consentimiento_html,
       -- Y si el profesional ya le abrio un consentimiento NUEVO en Atlas, de cualquier rama.
       exists (select 1 from patient_consents pc where pc.patient_id = pa.id)        as tiene_algun_consent_atlas
  from evaluations e
  join patients pa on pa.id = e.patient_id
  join patient_profiles pp on pp.patient_id = pa.id
 where e.import_batch_id is not null
   and pp.birth_date is not null
   and (date_part('year', age(pp.birth_date)) < 18)
   and not exists (
     select 1 from patient_consents pc
      where pc.patient_id = pa.id and pc.consent_type = 'representante_legal' and pc.revoked_at is null
   )
 order by 5, 6;

-- ── (C) Y EL CASO CONTRARIO, por si existe ───────────────────────────────────────────────────────
--
-- Un paciente con consentimiento de representante legal que YA cumplio 18: el chequeo tambien lo bloquea, por
-- el otro lado ("el documento indica mayoria de edad, pero el consentimiento se otorgo por un representante").
-- Se mira porque es la misma clase de bloqueo y nadie lo ha buscado.
select 'C · mayores con consentimiento de representante'                 as consulta,
       e.id                                                              as evaluacion,
       date_part('year', age(pp.birth_date))::int                        as edad_hoy,
       e.status                                                          as estado
  from evaluations e
  join patients pa on pa.id = e.patient_id
  join patient_profiles pp on pp.patient_id = pa.id
 where pp.birth_date is not null
   and (date_part('year', age(pp.birth_date)) >= 18)
   and e.status = 'draft'
   and exists (
     select 1 from patient_consents pc
      where pc.patient_id = pa.id and pc.consent_type = 'representante_legal' and pc.revoked_at is null
   )
 order by 3;
