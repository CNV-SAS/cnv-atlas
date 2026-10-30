-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ELIMINAR EL PERFIL SIN DESTRUIR LA HISTORIA  ·  v12 §1.2, construido el 2026-10-30
--
-- ── LO QUE PIDIO, Y POR QUE EL BORRADO LOGICO NO ES UN PASO INTERMEDIO ─────────────────────────────
--
-- Gildardo, en v12: *"Constrúyelo como borrado lógico (una marca de eliminado con fecha y autor) hasta
-- que yo lo confirme: así sirve para cualquiera de las dos respuestas."* Lo que dice que va a decidir es
-- si "eliminar perfil" borra de verdad o archiva y oculta.
--
-- Y ESA PREGUNTA YA ESTA CERRADA, no por nosotros: `DATA_GOVERNANCE.md` dice que el derecho al olvido se
-- atiende *"por anonimizacion o desvinculacion de identidad, no destruyendo evidencia clinica sujeta a
-- retencion legal"*, y la tabla de retencion da 15 anos a la historia clinica (Resoluciones 1995/1999 y
-- 839/2017). Asi que el borrado logico no es el paso intermedio: es la respuesta. Queda escrito aqui
-- porque el dia que alguien pregunte por que no hay un `delete`, la respuesta tiene que estar al lado.
--
-- Y HAY UN SEGUNDO FRENO QUE YA EXISTE: un diagnostico confirmado es una firma clinica y la base lo
-- bloquea con un trigger (es la razon por la que la 0180 construyo MARCAR antes que borrar). O sea que
-- para el caso mas comun, el borrado duro no estaba disponible ni tecnicamente.
--
-- ── LA ASIMETRIA ES LA DE LA 0180, Y POR LA MISMA RAZON ────────────────────────────────────────────
--
-- `is_test` la pide el profesional y la confirma un administrador porque marcar a alguien de prueba lo
-- SACA DE LAS CIFRAS: si el profesional pudiera solo, tendria como esconder a sus pacientes incomodos.
-- Retirar a un paciente hace lo mismo y mas (sale de la lista, de las cifras y de la cohorte de
-- investigacion), asi que arrastra el mismo incentivo. La 0180 ya lo dejo escrito: *"es la misma
-- asimetria que Santiago pidio para el borrado, y por la misma razon"*.
--
-- Por eso las columnas vienen en dos mitades: la PETICION (quien la pide, cuando y por que) y el ACTO
-- (quien la ejecuta y cuando). Con una sola mitad no se puede distinguir lo pedido de lo hecho.
--
-- ── LO QUE *NO* HACE, Y CONVIENE SABERLO ──────────────────────────────────────────────────────────
--
--   · NO borra filas. `deleted_at` la filtran ya ONCE lectores (la lista via la vista del roster, la
--     ficha, la busqueda por documento, la resolucion de identidad, el import del HTML, la revocacion de
--     consentimiento, las dos vistas de investigacion, el roster del integrante y lo que queda abierto).
--   · NO libera la huella de su medicion. El freno del import (`buscarLaMismaMedicion`) no filtra
--     `deleted_at`, asi que la misma toma fisica sigue sin poder entrar dos veces. Es lo correcto:
--     eliminar el perfil no desmide su cuerpo. (El AVISO de la lista si lo filtra, y tambien es
--     correcto: el chip es para el trabajo vivo.)
--   · NO toca las ventas ni las facturas: son documentos fiscales con su propia retencion, y en Atlas
--     viven en `transactions` sin cascada desde `patients`.
--   · NO arrastra ni lo arrastra la inactivacion del profesional (0229): su profesional se va y el
--     paciente sigue siendo de CNV.
--   · Y EL EXPORT DE CUSTODIA, cuando se construya, NO puede filtrar `deleted_at`: al terminar la
--     relacion con un Integrante hay que entregarle las historias en 10 dias habiles, y un paciente
--     eliminado sigue teniendo historia que entregar.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patients"
  -- LA PETICION. Nula = nadie ha pedido nada.
  ADD COLUMN IF NOT EXISTS "eliminacion_pedida_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "eliminacion_pedida_por" uuid,
  -- EL MOTIVO ES UNO Y VIAJA DE LA PETICION AL ACTO. Reescribirlo al confirmar seria perder lo que el
  -- profesional dijo, que es lo unico con lo que la direccion puede decidir.
  ADD COLUMN IF NOT EXISTS "eliminacion_motivo" text,
  -- Y QUIEN LO EJECUTO. `deleted_at` (que existe desde la 0000) dice cuando.
  ADD COLUMN IF NOT EXISTS "eliminado_por" uuid;--> statement-breakpoint

-- SIN FK A `profiles`, igual que la 0229 y por su misma razon: `patients` ya tiene DOS relaciones hacia
-- `profiles` (`test_proposed_by`, `test_marked_by`), y cada relacion nueva hacia una tabla ya referenciada
-- vuelve mas ambiguos los embeds de PostgREST que la nombran, que es la familia de cambio que rompio tres
-- consultas sin relacion con el FK nuevo el 2026-08-12. El "quien" se responde ademas por el asiento de
-- auditoria, que es append-only y no depende de estas columnas.
COMMENT ON COLUMN "patients"."eliminacion_pedida_por" IS
  'Quien pidio eliminar el perfil (profiles.id). Sin FK: ver la nota de la 0229 sobre los embeds.';--> statement-breakpoint
COMMENT ON COLUMN "patients"."eliminacion_motivo" IS
  'Por que se pidio. Obligatorio con la peticion: sin motivo, quien confirma tendria que adivinar.';--> statement-breakpoint
COMMENT ON COLUMN "patients"."eliminado_por" IS
  'Quien ejecuto la eliminacion (profiles.id). Nunca es la peticion: la 0180 fija la asimetria.';--> statement-breakpoint
COMMENT ON COLUMN "patients"."deleted_at" IS
  'Retiro LOGICO: la fila y su historia se conservan (15 anos, DATA_GOVERNANCE). Once lectores la filtran.';--> statement-breakpoint

-- ── LOS DOS CHECK: NI MEDIA PETICION, NI UN RETIRO SIN QUIEN NI POR QUE ───────────────────────────
--
-- Mismo criterio que la 0095, la 0180, la 0226 y la 0229: lo que viaja junto se amarra en la base, porque
-- una mitad escrita y la otra no es el estado que deja la pantalla diciendo algo que la base no sostiene.
-- Media peticion (fecha sin motivo) es ademas el caso que aparece solo cuando alguien agrega la columna al
-- formulario y olvida el campo.
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_peticion_de_eliminacion_completa";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_peticion_de_eliminacion_completa" CHECK (
    ("eliminacion_pedida_at" IS NULL) = ("eliminacion_pedida_por" IS NULL)
    AND ("eliminacion_pedida_at" IS NOT NULL OR "eliminacion_motivo" IS NULL)
    AND ("eliminacion_pedida_at" IS NULL OR btrim(COALESCE("eliminacion_motivo", '')) <> '')
  );--> statement-breakpoint

ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_eliminacion_coherente";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_eliminacion_coherente" CHECK (
    ("deleted_at" IS NULL) = ("eliminado_por" IS NULL)
    -- Y NO HAY RETIRO SIN PETICION: es la asimetria, escrita donde no se puede saltar desde la aplicacion.
    AND ("deleted_at" IS NULL OR "eliminacion_pedida_at" IS NOT NULL)
  );--> statement-breakpoint

-- ── LA RLS: EL `UPDATE` DE `patients` NO BASTABA ──────────────────────────────────────────────────
--
-- `patients_update` (0003) deja escribir al profesional dueno o a admin, y eso ES correcto para los campos
-- que ya tenia. Pero por esa misma policy, con la anon key (que es publica) un profesional podria escribir
-- `deleted_at` DE SU PROPIO PACIENTE sin pasar por la aplicacion, y entonces la asimetria seria un adorno
-- de la pantalla.
--
-- SE CIERRA CON UN TRIGGER Y NO CON UNA POLICY, por una razon de forma: una policy decide si la fila se
-- puede tocar, no QUE columna cambio. Para distinguir "cambio el telefono" de "se elimino el perfil del paciente" hay
-- que mirar el valor viejo contra el nuevo, y eso es lo que un trigger ve.
--
-- LA ESCRITURA DE LA APLICACION PASA porque los writers van por el dueno de la base (drizzle), no por la
-- anon key. No es un permiso general: es el mismo camino por el que ya escriben los writers de la 0180,
-- con su policy en el servidor y su asiento de auditoria inline.
--
-- SE NOMBRAN LOS ROLES QUE SE FRENAN (`anon`, `authenticated`), no los que pasan, y es deliberado: son
-- exactamente los dos roles que alcanza una clave publica. Un allow-list de `postgres` frenaria tambien a
-- cualquier camino de servidor futuro, que es un fallo que aparece lejos de aqui y no se entiende.
--
-- Y SIN `SECURITY DEFINER`, que es el error facil: dentro de una funcion definer `current_user` es el
-- DUENO de la funcion, asi que la comparacion siempre pasaria y el freno no frenaria nada.
CREATE OR REPLACE FUNCTION public.la_eliminacion_del_paciente_pasa_por_la_direccion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND ((OLD."deleted_at" IS NULL) <> (NEW."deleted_at" IS NULL)
          OR (OLD."eliminado_por" IS NULL) <> (NEW."eliminado_por" IS NULL)) THEN
    RAISE EXCEPTION 'eliminar o restituir a un paciente se hace desde Atlas, con su motivo y su rastro';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "la_eliminacion_pasa_por_la_direccion" ON "patients";--> statement-breakpoint
CREATE TRIGGER "la_eliminacion_pasa_por_la_direccion"
  BEFORE UPDATE ON "patients"
  FOR EACH ROW
  EXECUTE FUNCTION public.la_eliminacion_del_paciente_pasa_por_la_direccion();--> statement-breakpoint

COMMENT ON FUNCTION public.la_eliminacion_del_paciente_pasa_por_la_direccion() IS
  'La asimetria de la 0180 para la eliminacion: con la anon key no se escribe deleted_at, aunque el paciente sea suyo.';
