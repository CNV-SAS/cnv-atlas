-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- FIRMAR LOS DIAGNOSTICOS QUE QUEDARON SIN RESPONSABLE  ·  2026-09-18
--
-- POR QUE: hasta hoy la firma clinica (`confirmed_by`) la ponia APROBAR EL REPORTE, que es un documento de
-- envio. Quien no enviaba reporte dejaba el diagnostico sin responsable: 23 de 27, y son pacientes reales de
-- Integrantes reales. Desde el cambio del 2026-09-18 el diagnostico nace firmado; esto cierra los de atras.
--
-- DE DONDE SALE EL NOMBRE, en este orden:
--   1. EL REGISTRO DE AUDITORIA (`clinical_audit_log`, evento `diagnosis.created`): dice quien lo genero de
--      verdad, que es exactamente lo que la firma registra. Es la fuente buena.
--   2. EL PROFESIONAL DE LA EVALUACION, como respaldo: se sella al crearla y la base impide cambiarlo
--      (FK con ON DELETE RESTRICT y sin camino de escritura posterior), asi que no es "el que hoy tiene
--      asignado el paciente": es el que atendio esa consulta.
-- Si ninguna de las dos lo dice, la fila se DEJA EN PAZ y se reporta: firmar con quien no atendio seria peor
-- que dejarlo vacio.
--
-- LA PROFESION se sella tambien, leida del perfil profesional de esa persona. Queda null si no la tiene
-- configurada (hoy el onboarding no la captura), igual que cuando firma un administrador.
--
-- ESTO NO PISA NADA: solo toca filas con `confirmed_by IS NULL`, y el trigger 0027 permite exactamente eso
-- (null -> valor) y bloquea cambiar o borrar una firma ya puesta.
--
-- COMO SE CORRE: primero sin --commit para ver el reporte; despues con --commit.
--   $env:DATABASE_URL = "postgresql://...la de migrar, puerto 5432..."
--   node scripts/aplicar-migracion.mjs scripts/firmar-diagnosticos-sin-responsable.sql
--   node scripts/aplicar-migracion.mjs scripts/firmar-diagnosticos-sin-responsable.sql --commit
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  sin_firma      int;
  por_auditoria  int;
  por_evaluacion int;
  quedan         int;
  r              record;
begin
  select count(*) into sin_firma from diagnoses where confirmed_by is null;
  raise notice 'Diagnosticos sin responsable antes: %', sin_firma;

  -- 1. LA FUENTE BUENA: quien lo genero, segun la auditoria.
  with generador as (
    select d.id as diagnosis_id,
           (select a.actor_id
              from clinical_audit_log a
             where a.entity_type = 'diagnosis' and a.entity_id = d.id::text
               and a.event = 'diagnosis.created' and a.actor_id is not null
             order by a.created_at asc limit 1) as actor_id
      from diagnoses d
     where d.confirmed_by is null
  )
  update diagnoses d
     set confirmed_by = g.actor_id,
         confirmed_at = coalesce(
           (select a.created_at from clinical_audit_log a
             where a.entity_type = 'diagnosis' and a.entity_id = d.id::text and a.event = 'diagnosis.created'
             order by a.created_at asc limit 1),
           d.created_at),
         confirmed_profession = (select pp.profession from professional_profiles pp where pp.profile_id = g.actor_id)
    from generador g
   where d.id = g.diagnosis_id and g.actor_id is not null and d.confirmed_by is null;
  get diagnostics por_auditoria = row_count;
  raise notice 'Firmados con el registro de auditoria (quien lo genero): %', por_auditoria;

  -- 2. EL RESPALDO: el profesional con el que se creo la evaluacion.
  update diagnoses d
     set confirmed_by = pr.id,
         confirmed_at = d.created_at,
         confirmed_profession = pp.profession
    from evaluations e
    join professional_profiles pp on pp.id = e.professional_id
    join profiles pr on pr.id = pp.profile_id
   where d.evaluation_id = e.id and d.confirmed_by is null;
  get diagnostics por_evaluacion = row_count;
  raise notice 'Firmados con el profesional de la evaluacion (respaldo): %', por_evaluacion;

  -- 3. LO QUE NO SE PUDO: se deja en paz y se dice cual es.
  select count(*) into quedan from diagnoses where confirmed_by is null;
  if quedan > 0 then
    raise notice 'SIN FIRMAR, y se quedan asi (ninguna fuente dice quien atendio): %', quedan;
    for r in select d.id, d.created_at::date as dia from diagnoses d where d.confirmed_by is null order by d.created_at limit 10 loop
      raise notice '  diagnostico % del %', r.id, r.dia;
    end loop;
  else
    raise notice 'No queda ninguno sin responsable.';
  end if;
end $$;

commit;
