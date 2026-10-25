-- INACTIVAR A UN PROFESIONAL SIN BORRAR SU CUENTA (Gildardo, 2026-10-25; regla dura 14).
--
-- ── QUE HABIA, Y POR QUE NO BASTABA ────────────────────────────────────────────────────────────────
--
-- La mitad de "desactivar" EXISTIA a medias, y eso es peor que no existir, porque se lee como construida:
--
--   · `profiles.status` ('active' | 'inactive') esta desde la 0000.
--   · `requireUser()` manda a /auth/logout a quien no este 'active', asi que una sesion abierta muere en el
--     siguiente render del servidor. Eso SI funciona.
--   · `deactivateUser()` existe como server action desde el principio... Y NO LA LLAMA NADIE. No tiene
--     pantalla, no pide motivo, no deja rastro de por que, y no tiene vuelta atras. El unico camino para
--     inactivar a alguien era un UPDATE a mano.
--   · Y `check:cables` la daba por cableada: el detector cuenta las veces que el nombre aparece en su propio
--     archivo, y `reportServerError("deactivateUser", e)` mas `deactivateUserSchema` ya eran tres. El
--     control que existe para encontrar exactamente esto la paso por alto (arreglado en el mismo commit).
--
-- ── PIEZA 1: EL MOTIVO Y EL RASTRO VIAJAN CON EL ESTADO ────────────────────────────────────────────
--
-- `status = 'inactive'` a secas no contesta nada de lo que se pregunta despues: quien le quito el acceso,
-- cuando y por que. Y es la pregunta que llega sola, porque sus pacientes siguen siendo suyos, se le sigue
-- debiendo su margen y su inventario sigue en su vitrina.
--
-- LAS TRES COLUMNAS VIAJAN JUNTAS, y ademas AMARRADAS AL ESTADO (mismo criterio que la 0095 y la 0226, un
-- paso mas): el CHECK exige que `status = 'inactive'` y `inactivo_desde IS NOT NULL` sean la misma cosa. Con
-- eso no cabe un inactivo sin motivo ni un motivo sobre una cuenta activa, que son los dos estados que
-- dejarian la pantalla diciendo algo que la base no sostiene.
--
-- ES REVERSIBLE, asi que las columnas describen la inactivacion VIGENTE y se limpian al reactivar. La
-- HISTORIA de las idas y venidas vive en `clinical_audit_log` (`user.deactivated` / `user.reactivated`),
-- que es donde ya vive todo lo demas y no se borra. Dos sitios para lo mismo es como se llega a que el
-- segundo contradiga al primero.
--
-- HOY ES GRATIS: los 18 perfiles de produccion estan 'active', asi que el CHECK no obliga a rellenar nada.
-- Igual se escribe el backfill por si alguna base local tiene un inactivo de una prueba vieja: sin el, la
-- migracion fallaria al crear el CHECK y nadie sabria por que.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "inactivo_desde" timestamp with time zone,
  -- SIN FK a profiles A PROPOSITO. Seria la PRIMERA relacion de `profiles` consigo misma, y aunque hoy
  -- ninguna consulta embebe `profiles` desde `profiles`, es justo la familia de cambio que rompio tres
  -- embeds de comodato, faltantes y remesa el 2026-08-12 (ARCHITECTURE: un FK nuevo hacia una tabla ya
  -- referenciada vuelve ambiguos los embeds existentes, y tsc no lo ve). Quien lo hizo queda, ademas, en el
  -- asiento de auditoria, que es de donde se responde "quien" sin depender de esta columna.
  ADD COLUMN IF NOT EXISTS "inactivado_por" uuid,
  ADD COLUMN IF NOT EXISTS "inactivacion_motivo" text;--> statement-breakpoint

-- Backfill defensivo: un inactivo anterior a esta migracion no tiene motivo que recuperar, y decirlo es mas
-- honesto que inventar uno.
UPDATE "profiles"
   SET "inactivo_desde" = COALESCE("inactivo_desde", "updated_at", now()),
       "inactivacion_motivo" = COALESCE(
         "inactivacion_motivo",
         'Inactivado antes de que el motivo se registrara (migracion 0229).'
       )
 WHERE "status" = 'inactive';--> statement-breakpoint

ALTER TABLE "profiles"
  DROP CONSTRAINT IF EXISTS "profiles_inactivacion_coherente";--> statement-breakpoint
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_inactivacion_coherente" CHECK (
    ("status" = 'inactive') = ("inactivo_desde" IS NOT NULL)
    AND ("inactivo_desde" IS NULL) = ("inactivacion_motivo" IS NULL)
  );--> statement-breakpoint

COMMENT ON COLUMN "profiles"."inactivo_desde" IS
  'Cuando se le quito el acceso. Amarrado por CHECK a status = inactive: uno no puede existir sin el otro.';--> statement-breakpoint
COMMENT ON COLUMN "profiles"."inactivacion_motivo" IS
  'Por que se le quito el acceso. Obligatorio: un inactivo sin motivo no contesta la pregunta que llega despues.';--> statement-breakpoint
COMMENT ON COLUMN "profiles"."inactivado_por" IS
  'Quien lo inactivo (profiles.id). Sin FK: ver la nota de la migracion 0229 sobre los embeds de PostgREST.';--> statement-breakpoint

-- ── PIEZA 2: LA CUENTA INACTIVA TAMPOCO ABRE LA PUERTA POR DEBAJO DE LA APLICACION ─────────────────
--
-- Esto es lo que faltaba de verdad. `requireUser()` lo saca de las PANTALLAS, pero la RLS no miraba
-- `profiles.status` en ningun sitio: con su token de acceso todavia vivo, una llamada directa a la API
-- (la anon key es publica) seguia pasando las policies, porque `has_role` solo pregunta por pertenencia a
-- un rol y `is_patient_professional` solo por la relacion con el paciente.
--
-- SE CIERRA EN DOS FUNCIONES Y NO EN CINCUENTA POLICIES, y es a proposito: casi todas las policies pasan
-- por una de las dos, asi que el punto unico las cubre y no deja una sin barrer. La alternativa (un
-- conjunto `cuenta_activa()` pegado a cada policy) es la que se olvida en la policy numero 48.
--
-- Y REVOCAR LA SESION NO SUSTITUYE A ESTO: bloquear la cuenta mata el inicio de sesion y el refresco, pero
-- el token de acceso ya emitido sigue siendo valido su hora. Esta es la mitad que cubre esa hora.
--
-- ── Y AQUI HAY UNA MEDICION, PORQUE LA PRIMERA VERSION COSTABA EL 75 % ────────────────────────────
--
-- `has_role` se evalua UNA VEZ por consulta (las policies de la 0222 la envuelven en `(select ...)`), asi
-- que ahi la funcion aparte es gratis. `is_patient_professional` NO: se evalua POR FILA, y una funcion
-- `security definer` NO SE PUEDE INLINE, asi que llamar a `cuenta_activa()` desde dentro era una segunda
-- llamada por cada paciente del roster. Medido en local sobre 149 filas, cinco corridas:
--
--     sin chequeo (0222)                      66, 69, 69, 73, 69 ms
--     con `and (select cuenta_activa())`     116, 116, 116, 117, 123 ms   <- +75 %
--     con el estado como JOIN en el exists    70, 72, 74, 79, 80 ms       <- dentro del ruido
--
-- Por eso el estado va como JOIN DENTRO del mismo `exists`: es una lectura mas por clave primaria en una
-- consulta que ya se estaba haciendo, no una llamada de funcion mas por fila. Esta es LA MISMA RUTA que
-- tumbo la lista de pacientes por timeout, asi que un +75 % aqui no es un detalle de rendimiento.
create or replace function public.cuenta_activa()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = (select auth.uid())), false)
$$;--> statement-breakpoint

comment on function public.cuenta_activa() is
  'Si la cuenta de la sesion sigue habilitada. false tambien cuando no hay perfil (un token sin perfil no autoriza nada).';--> statement-breakpoint

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select public.cuenta_activa())
     and exists(
       select 1 from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       where ur.user_id = (select auth.uid()) and r.name = p_role
     )
$$;--> statement-breakpoint

create or replace function public.is_patient_professional(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.professional_profiles pp
    join public.profiles pr on pr.id = pp.profile_id
    where pp.profile_id = (select auth.uid())
      and pr.status = 'active'
      and public.is_patient_of(p_patient_id, pp.id)
  )
$$;--> statement-breakpoint

grant execute on function public.cuenta_activa() to authenticated;
