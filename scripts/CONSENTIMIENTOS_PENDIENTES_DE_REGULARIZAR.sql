-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿A QUIEN LE VA A APARECER "PENDIENTE DE REGULARIZAR"?  ·  pieza 2 del consentimiento  ·  2026-10-15
--
-- ═══ PARA QUE ═══
--
-- La pantalla responde POR UN PACIENTE: se abre su ficha y el panel lo dice. Esto responde POR TODOS, que es
-- lo que hace falta ANTES de probar (saber a quien vas a ver marcado y cuantos son) y despues de cualquier
-- correccion de fecha de nacimiento.
--
-- ES DE SOLO LECTURA. No escribe nada, no hay `commit` ni `rollback` que decidir.
--
-- ═══ DE DONDE SALE EL CASO (dictamen legal, 2026-10-09) ═══
--
-- Pacientes MENORES que consintieron por el QR cuando ese camino no tenia rama de menor: su consentimiento
-- quedo guardado SIN REPRESENTANTE. Tienen las autorizaciones necesarias vigentes y ninguna la otorgo quien
-- podia otorgarla. Textual: *"el registro actual no se borra. Se conserva marcado como insuficiente, porque
-- es la evidencia de que algo se firmo ese dia."*
--
-- LA PREVENCION YA ESTA (un consentimiento asi no se puede guardar desde el 2026-10-09, decidido por la EDAD
-- y no por la rama declarada), asi que esta lista NO PUEDE CRECER por casos nuevos. Solo se vacia.
--
-- ⚠ LOS UMBRALES SE REPITEN AQUI (18 años) porque un script SQL no puede importar `ADULT_MIN_AGE`. La misma
--   salvedad que en `RAMA_DEL_CONSENTIMIENTO_CONTRA_LA_FECHA_DE_HOY.sql`. La regla VIVE en
--   `src/modules/consent/regularizacion.ts`, con candado; esto es un barrido, no una segunda definicion.
--
-- COMO SE CORRE:
--   psql "<cadena>" -f scripts/CONSENTIMIENTOS_PENDIENTES_DE_REGULARIZAR.sql
--
-- LO NORMAL ES QUE DEVUELVA POCO O NADA, y eso ya es una respuesta.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with necesarias as (
  -- LA FIRMA QUE CUENTA ES LA MAS RECIENTE DE LAS NECESARIAS, igual que en el modulo: un menor que firmo a
  -- los 13 y volvio a firmar a los 19 ya tiene un consentimiento otorgado por quien podia otorgarlo.
  select pc.patient_id,
         max(pc.signed_at)        as ultima_firma,
         max(pc.consent_version)  as version,
         max(pc.signature_channel) as canal
    from patient_consents pc
   where pc.revoked_at is null
     and pc.consent_type in ('servicio', 'datos_sensibles', 'internacional_ia')
   group by pc.patient_id
),
con_representante as (
  select distinct patient_id
    from patient_consents
   where revoked_at is null and consent_type = 'representante_legal'
)
select pa.document_type || ' ' || pa.document_number                                   as documento,
       coalesce(pa.cuenta_como_de_prueba, false)                                       as de_prueba,
       n.canal,
       n.version,
       n.ultima_firma::date                                                            as firmo_el,
       pp.birth_date                                                                   as fecha_de_nacimiento,
       extract(year from age(n.ultima_firma::date, pp.birth_date))::int                as edad_al_firmar,
       extract(year from age(current_date, pp.birth_date))::int                        as edad_hoy,
       case
         -- UNA FECHA POSTERIOR A LA FIRMA ES OTRO PROBLEMA, Y NO SE DISFRAZA DE ESTE: sin esta rama el
         -- sistema le pediria un representante legal a un adulto cuya fecha esta mal digitada.
         when extract(year from age(n.ultima_firma::date, pp.birth_date)) < 0
           then 'FECHA IMPOSIBLE: la fecha de nacimiento es posterior a la firma. Corregirla en la ficha; no frena nada.'
         when extract(year from age(current_date, pp.birth_date)) < 18
           then 'MENOR HOY TAMBIEN: volver a firmar con su representante legal (el representante recibe el codigo y firma).'
         else 'YA ES MAYOR: volver a firmar como adulto. Es un acto de dos minutos y queda completo.'
       end                                                                             as que_hacer
  from necesarias n
  join patients pa          on pa.id = n.patient_id and pa.deleted_at is null
  join patient_profiles pp  on pp.patient_id = n.patient_id
  left join con_representante r on r.patient_id = n.patient_id
 where pp.birth_date is not null
   and extract(year from age(n.ultima_firma::date, pp.birth_date)) < 18
   and r.patient_id is null
 -- LOS REALES PRIMERO: son los unicos que hay que atender.
 order by coalesce(pa.cuenta_como_de_prueba, false), n.ultima_firma;
