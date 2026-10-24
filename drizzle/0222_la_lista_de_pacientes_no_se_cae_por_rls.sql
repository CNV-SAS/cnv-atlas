-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- /pacientes SE CAIA POR TIEMPO, Y EL COSTO ERA LA RLS, NO LA CONSULTA  ·  0222
--
-- ═══ EL CASO (Sentry, 2026-10-23 23:34 UTC, 4 eventos, Unhandled) ═══
--
--   patients-list-reader: listPatientsForProfessional: canceling statement due to statement timeout
--
-- La peticion murio con un 500 en `GET /pacientes` y la pantalla quedo caida. La consulta es la del
-- roster: `patients` con `patient_profiles`, `patient_consents` y `evaluations`, y dentro de esta ultima
-- `bis_measurements`, `evaluation_bis_intake`, `diagnoses` y `reports`.
--
-- ═══ LA MEDICION, Y ES DIFERENCIAL (2026-10-24, produccion) ═══
--
-- La MISMA consulta, con la MISMA cadena de embeds, contra los MISMOS datos:
--
--   · con `service_role` (que NO pasa por RLS):  489 ms, 552 pacientes, 654 KB
--   · con `authenticated` (que SI pasa):         supera el statement_timeout (8 s)
--
-- Entre esas dos cifras no hay ninguna otra diferencia: ni el plan de embeds, ni el volumen, ni la red.
-- Lo que las separa es la evaluacion de la RLS sobre las ~4.000 filas embebidas (552 pacientes + 552
-- perfiles + 2.230 consentimientos + 595 evaluaciones + 406 mediciones + diagnosticos y reportes). O sea
-- que el problema NO son los embeds en si: es que cada fila embebida paga su policy.
--
-- ═══ LO QUE SE ARREGLA AQUI, Y POR QUE ES INERTE ═══
--
-- Dos cambios, ninguno de semantica. Lo que podia ver cada rol sigue siendo EXACTAMENTE lo mismo, y eso
-- es lo que comprueba la suite de RLS entera, que se corre antes y despues.
--
-- 1 · EL `auth.uid()` DE LOS HELPERS SE ENVUELVE EN UN SUBSELECT. Una funcion `stable` de lenguaje SQL se
--     INLINA en la consulta que la llama, y ahi `auth.uid()` queda como una expresion que Postgres vuelve
--     a evaluar POR FILA (y cada evaluacion parsea el JSON de `request.jwt.claims`). Escrita como
--     `(select auth.uid())` se convierte en un InitPlan: se evalua UNA vez por consulta. Devuelve el mismo
--     valor; lo unico que cambia es cuantas veces se calcula.
--
-- 2 · EL `has_role('admin')` PASA AL FRENTE DEL `or`, TAMBIEN EN UN SUBSELECT. `has_role('admin')` no
--     mira ninguna columna, asi que `(select public.has_role('admin'))` tambien se hoistea a un InitPlan:
--     una sola evaluacion para toda la consulta. Y puesto PRIMERO, para un admin el `or` queda resuelto
--     y la comprobacion por fila ni se intenta.
--
--     Y ESTO NO ES UN CRITERIO NUEVO: las policies de `bis_measurements`, `bis_raw_values`, `diagnoses` y
--     las demas hijas de la evaluacion YA preguntan por el admin primero (0003 lineas 276, 291, 333). Las
--     de `patients`, `patient_profiles`, `patient_consents` y `evaluations` quedaron al reves, y son justo
--     las CUATRO tablas de la consulta del roster y las que mas filas traen. El repositorio ya tenia las
--     dos escrituras de la misma regla; esto las iguala.
--
-- ═══ LO QUE NO SE TOCA, A PROPOSITO ═══
--
-- Solo las policies de SELECT de esas cuatro tablas. Las de INSERT y UPDATE no participan en el sintoma, y
-- tocar una policy de escritura sin un sintoma que lo pida es riesgo sin beneficio. La condicion del
-- `status` de la relacion (la reasignacion) es otra decision y va en su propia migracion.
--
-- Y NO SUSTITUYE A ACOTAR LA CONSULTA: una lista que crece sin techo acaba volviendo a chocar con el
-- limite, con esta mejora o sin ella. Eso va por el lado del codigo (que la pantalla no reviente cuando
-- pase, y que las cifras de la fila no salgan de embeds) y esta dimensionado aparte.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1 · LOS HELPERS, con `auth.uid()` hoisteado ──────────────────────────────────────────────────
-- MISMA FIRMA, MISMA SEMANTICA, MISMO `security definer` y mismo `search_path` vacio. `is_patient_of` no
-- se toca: no lee `auth.uid()` (recibe el profesional por parametro) y su grant quedo restringido a
-- `service_role` en la 0107.
create or replace function public.is_patient_professional(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.professional_profiles pp
    where pp.profile_id = (select auth.uid())
      and public.is_patient_of(p_patient_id, pp.id)
  )
$$;--> statement-breakpoint

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.name = p_role
  )
$$;--> statement-breakpoint

create or replace function public.current_user_roles()
returns setof public.app_role
language sql stable security definer set search_path = ''
as $$
  select r.name from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = (select auth.uid())
$$;--> statement-breakpoint

-- ── 2 · LAS CUATRO POLICIES DE SELECT DEL ROSTER, con el admin al frente ─────────────────────────
drop policy if exists "patients_select" on public.patients;--> statement-breakpoint
create policy "patients_select" on public.patients
  for select to authenticated using (
    (select public.has_role('admin'))
    or (select public.has_role('soporte'))
    or public.is_patient_professional(id)
  );--> statement-breakpoint

drop policy if exists "patient_profiles_select" on public.patient_profiles;--> statement-breakpoint
create policy "patient_profiles_select" on public.patient_profiles
  for select to authenticated using (
    (select public.has_role('admin')) or public.is_patient_professional(patient_id)
  );--> statement-breakpoint

drop policy if exists "patient_consents_select" on public.patient_consents;--> statement-breakpoint
create policy "patient_consents_select" on public.patient_consents
  for select to authenticated using (
    (select public.has_role('admin')) or public.is_patient_professional(patient_id)
  );--> statement-breakpoint

drop policy if exists "evaluations_select" on public.evaluations;--> statement-breakpoint
create policy "evaluations_select" on public.evaluations
  for select to authenticated using (
    (select public.has_role('admin')) or public.is_patient_professional(patient_id)
  );--> statement-breakpoint

comment on function public.is_patient_professional(uuid) is
  'Este paciente es del profesional de la sesion. Delega en is_patient_of (0106). El auth.uid() va en un subselect (0222) para que se evalue UNA vez por consulta y no una por fila: la lista de /pacientes se caia por statement timeout con ~4.000 filas embebidas, cada una pagando su policy.';
