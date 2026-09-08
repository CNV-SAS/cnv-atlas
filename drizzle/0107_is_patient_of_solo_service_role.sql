-- ACOTA QUIEN PUEDE EJECUTAR `is_patient_of`. Forward-only.
--
-- POR QUE VA EN SU PROPIA MIGRACION Y NO DENTRO DE LA 0106: la 0106 ya estaba aplicada cuando se midio
-- esto. Una migracion aplicada no se toca ni en local (ARCHITECTURE): la que se editaria en local es la
-- misma que ya corrio en otro sitio, y a partir de ahi las dos bases dejan de ser comparables.
--
-- LO QUE SE MIDIO. Postgres concede EXECUTE a PUBLIC por defecto al crear una funcion, asi que
-- `is_patient_of` quedo ejecutable tambien por `anon` y `authenticated`:
--
--     has_function_privilege('anon', 'public.is_patient_of(uuid,uuid)', 'EXECUTE') -> true
--
-- Es una funcion `security definer` que contesta "¿este paciente es de este profesional?". Explotarla
-- exige adivinar DOS uuid opacos, asi que el riesgo real es bajo; pero la funcion se creo justamente para
-- contestar esa pregunta desde una superficie publica, y dejarla abierta a cualquiera con la anon key
-- amplia la superficie sin que nadie lo necesite.
--
-- QUIEN SI LA NECESITA, y son dos:
--   · `service_role`, que es quien la llama desde el intake publico (el paciente no tiene sesion);
--   · nadie mas. `is_patient_professional` la invoca por dentro, y como ES `security definer`, la llamada
--     interna corre con los privilegios del dueño de la funcion, no con los de quien entro. Las policies
--     siguen funcionando igual para `authenticated`: se verifica con rls.test.ts antes y despues.
revoke execute on function public.is_patient_of(uuid, uuid) from public;
revoke execute on function public.is_patient_of(uuid, uuid) from anon;
revoke execute on function public.is_patient_of(uuid, uuid) from authenticated;
grant execute on function public.is_patient_of(uuid, uuid) to service_role;

-- NO SE TOCA `is_patient_professional`: esa SI la ejecuta `authenticated` en cada policy, y su grant por
-- defecto es correcto. Solo se acota la nueva.
