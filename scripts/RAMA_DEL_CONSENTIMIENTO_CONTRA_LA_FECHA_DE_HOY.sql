-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿ALGUN CONSENTIMIENTO PRESENCIAL QUEDO BAJO LA RAMA EQUIVOCADA?  ·  2026-10-14
--
-- ═══ DE DONDE SALE: EL HALLAZGO DEL ABOGADO (2026-10-14) ═══
--
-- Textual suyo: *"lo que determina el texto declarado es la fecha de nacimiento tal como estaba al emitir el
-- pase. Si esa fecha esta mal digitada y se corrige despues, el consentimiento ya firmado quedo bajo la rama
-- equivocada, y NADA LO VA A DETECTAR."*
--
-- Y NO PIDE CAMBIAR EL DISEÑO: elegir la rama UNA VEZ, en la emision, es lo correcto, porque la alternativa
-- es que cambie a mitad del acto. Pide que una correccion de fecha que cruce un umbral (los 18, o los 14 del
-- asentimiento) marque ese consentimiento para revision.
--
-- NO ES HIPOTETICO: ya hubo TRES correcciones de fecha de nacimiento en este proyecto (las de la fecha
-- imposible, 2026-10-09).
--
-- ═══ POR QUE ES UN SCRIPT Y NO UN AVISO EN PANTALLA (todavia) ═══
--
-- Porque el estado de "consentimiento pendiente de revision" es la PIEZA 2 del consentimiento, que no esta
-- construida, y abrirle un mecanismo propio a este caso seria un segundo constructor del mismo insumo: el
-- dia que la pieza 2 exista habria dos sitios donde se decide lo mismo. Mientras tanto, esto es la
-- DETECCION, que es la mitad que de verdad faltaba (su frase era "nada lo va a detectar").
--
-- ═══ Y NO NECESITA NINGUNA COLUMNA NUEVA ═══
--
-- La sesion ya congela la fecha con la que se emitio el pase (`patient_birth_date`, 0216). Asi que la
-- incoherencia se calcula con lo que hay: la fecha congelada contra la del paciente HOY.
--
-- LAS DOS EDADES SE MIDEN EL DIA DEL ACTO, no hoy. Un menor que cumplio 18 al mes siguiente firmo BIEN, y
-- compararlo contra hoy lo marcaria mal. Lo que se busca es un error de digitacion, no el paso del tiempo.
--
-- COMO SE CORRE:
--   psql "<cadena>" -f scripts/RAMA_DEL_CONSENTIMIENTO_CONTRA_LA_FECHA_DE_HOY.sql
--
-- CUANDO: despues de corregir cualquier fecha de nacimiento, y de vez en cuando. Lo normal es que no
-- devuelva nada, y eso ya es una respuesta.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- LOS UMBRALES VIVEN EN EL CODIGO (`ADULT_MIN_AGE` = 18, `ASSENT_MIN_AGE` = 14) y aqui se repiten porque un
-- script SQL no los puede importar. Si alguna vez cambian, cambian en los dos sitios: el candado
-- `declaracion-presencial-congelada` protege los TEXTOS, no estas dos cifras.
with sesiones as (
  select s.id                                   as sesion,
         s.patient_id,
         s.declaracion_version                  as version_declarada,
         s.patient_birth_date                   as fecha_al_emitir,
         pp.birth_date                          as fecha_de_hoy,
         (s.confirmed_at at time zone 'America/Bogota')::date as dia_del_acto,
         pa.document_type || ' ' || pa.document_number as documento
    from presencial_consent_sessions s
    join patients pa on pa.id = s.patient_id
    left join patient_profiles pp on pp.patient_id = s.patient_id
   where s.confirmed_at is not null
     -- SOLO LAS QUE PUEDEN SER INCOHERENTES: sin la fecha congelada (sesiones anteriores a la 0216) no se
     -- puede afirmar ni negar nada, y marcarlas seria inventar.
     and s.patient_birth_date is not null
     and pp.birth_date is not null
     and s.patient_birth_date <> pp.birth_date
),
-- LA EDAD EN AÑOS CUMPLIDOS AL DIA DEL ACTO, con las dos fechas. `age()` de Postgres devuelve un intervalo y
-- `extract(year from ...)` de ese intervalo son los años cumplidos, que es justo lo que se quiere.
edades as (
  select s.*,
         extract(year from age(s.dia_del_acto, s.fecha_al_emitir))::int as edad_con_la_vieja,
         extract(year from age(s.dia_del_acto, s.fecha_de_hoy))::int    as edad_con_la_nueva
    from sesiones s
),
ramas as (
  select e.*,
         case when e.edad_con_la_vieja >= 18 then '1.0'
              when e.edad_con_la_vieja >= 14 then '1.1-b'
              when e.edad_con_la_vieja >= 0  then '1.1-a' end as rama_que_se_uso,
         case when e.edad_con_la_nueva >= 18 then '1.0'
              when e.edad_con_la_nueva >= 14 then '1.1-b'
              when e.edad_con_la_nueva >= 0  then '1.1-a' end as rama_que_corresponde
    from edades e
)
select 'LA RAMA NO CORRESPONDE A LA FECHA DE HOY' as que,
       r.sesion,
       r.documento,
       r.fecha_al_emitir,
       r.fecha_de_hoy,
       r.dia_del_acto,
       r.edad_con_la_vieja,
       r.edad_con_la_nueva,
       r.version_declarada,
       r.rama_que_corresponde,
       -- QUE HAY QUE HACER CON CADA UNO, que no es lo mismo en los dos sentidos:
       case
         when r.rama_que_se_uso = '1.0' and r.rama_que_corresponde like '1.1%'
           then 'GRAVE: se declaro como ADULTO y era MENOR. Falta el representante legal. Hay que rehacer el consentimiento.'
         when r.rama_que_se_uso like '1.1%' and r.rama_que_corresponde = '1.0'
           then 'Se declaro como MENOR y era mayor de edad: hay un representante de mas, pero el paciente si pudo consentir por si mismo.'
         when r.rama_que_se_uso = '1.1-a' and r.rama_que_corresponde = '1.1-b'
           then 'Falta el ASENTIMIENTO: tenia 14 o mas y no se le pidio.'
         when r.rama_que_se_uso = '1.1-b' and r.rama_que_corresponde = '1.1-a'
           then 'Se afirmo un asentimiento de un menor de 14: la afirmacion sobra, el consentimiento del representante se sostiene.'
         else 'Revisar a mano.'
       end as que_hacer
  from ramas r
 where r.rama_que_se_uso is distinct from r.rama_que_corresponde
 order by r.dia_del_acto;

-- Y LA OTRA MITAD, QUE TAMBIEN HAY QUE MIRAR: sesiones confirmadas cuya fecha congelada SI coincide con la
-- de hoy, pero en las que la version guardada no corresponde a la edad. Eso no seria una correccion de
-- fecha: seria un defecto de la emision, y entonces el problema es otro y mas grave.
with coherencia as (
  select s.id as sesion,
         s.declaracion_version as version_declarada,
         extract(year from age((s.confirmed_at at time zone 'America/Bogota')::date, s.patient_birth_date))::int as edad,
         pa.document_type || ' ' || pa.document_number as documento
    from presencial_consent_sessions s
    join patients pa on pa.id = s.patient_id
   where s.confirmed_at is not null and s.patient_birth_date is not null
)
select 'LA VERSION NO CORRESPONDE A LA EDAD QUE LA SESION MISMA GUARDO' as que,
       c.sesion, c.documento, c.edad, c.version_declarada,
       case when c.edad >= 18 then '1.0' when c.edad >= 14 then '1.1-b' else '1.1-a' end as rama_que_corresponde
  from coherencia c
 where c.version_declarada is distinct from
       (case when c.edad >= 18 then '1.0' when c.edad >= 14 then '1.1-b' else '1.1-a' end)
 order by c.sesion;
