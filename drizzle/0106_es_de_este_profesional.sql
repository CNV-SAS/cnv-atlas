-- UNA SOLA DEFINICION DE "ES DE ESTE PROFESIONAL". Forward-only, sin cambio de semantica.
--
-- EL HUECO QUE ESTO HABILITA CERRAR (verificado, 2026-09-08): desde el enlace de consultorio, que es
-- publico y esta pensado para imprimirse y pegarse en la sala, se puede teclear la cedula de un paciente
-- de OTRO profesional de la organizacion. `findPatientByDocument` busca por organizacion (service role,
-- porque el paciente no tiene sesion), la resolucion devuelve modo 'seguimiento', y el writer hace:
--
--     insert into patient_professional_relationships (patient_id, professional_id) ... on conflict do nothing
--
-- Esa fila es EXACTAMENTE la que lee `is_patient_professional`, y esa funcion gobierna las policies de
-- patients, patient_profiles, patient_consents, evaluations y las demas. O sea que no es un problema de
-- atribucion: **el profesional queda con acceso permanente a la historia clinica completa de un paciente
-- que no era suyo**, y el gate de la regla 15 no lo para (el paciente ya tiene sus autorizaciones
-- vigentes, asi que pasa). Es escalada de privilegios.
--
-- POR QUE HACE FALTA TOCAR EL HELPER. Para cerrarlo hay que preguntar "¿este paciente es de ESTE
-- profesional?" desde una superficie PUBLICA, y `is_patient_professional` no sirve ahi: resuelve el
-- profesional por `auth.uid()`, y en el intake publico no hay sesion.
--
-- LA ALTERNATIVA ERA UNA SEGUNDA LECTURA en TypeScript con service role, y se descarto: seria una
-- segunda definicion de "es mio" capaz de divergir de la que de verdad gobierna el acceso, y la copia
-- siempre envejece. Es justo lo que el candado de la busqueda por documento prohibe.
--
-- LO QUE SE HACE, entonces: la regla se escribe UNA vez, parametrizada por profesional, y el helper de
-- siempre pasa a ser una llamada a ella con el profesional de la sesion. Las policies no cambian ni una
-- letra; `is_patient_professional` conserva firma, semantica y `security definer`.

-- La regla, parametrizada. `security definer` y `search_path` vacio, igual que el helper original: se
-- consulta desde policies y desde superficies sin sesion, y no puede depender de la RLS de la propia
-- tabla que consulta (seria recursivo).
create or replace function public.is_patient_of(p_patient_id uuid, p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    where ppr.patient_id = p_patient_id and ppr.professional_id = p_professional_id
  )
$$;

comment on function public.is_patient_of(uuid, uuid) is
  'Unica definicion de "este paciente es de este profesional". p_professional_id es un professional_profiles.id. La usan is_patient_professional (con el profesional de la sesion) y el intake publico (con el profesional del enlace).';

-- Y el helper de siempre delega. MISMA FIRMA Y MISMA SEMANTICA: resuelve el professional_profiles.id de
-- quien tiene la sesion y le pregunta a la regla. Antes hacia el join el mismo; ahora lo hace una vez.
create or replace function public.is_patient_professional(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.professional_profiles pp
    where pp.profile_id = auth.uid()
      and public.is_patient_of(p_patient_id, pp.id)
  )
$$;

-- NADA MAS CAMBIA. No se tocan policies, ni grants, ni tablas: quien podia ver que sigue viendo lo mismo.
-- La suite `rls.test.ts` se corre antes y despues, y es lo que sostiene esa afirmacion.
