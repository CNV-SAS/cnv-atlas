-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PASE PRESENCIAL DE UN MENOR DE EDAD  ·  2026-10-12  (pieza 3 del consentimiento)
--
-- EL HUECO QUE CIERRA: la modalidad 2 (QR) no tenia rama de menor. Si la fecha de nacimiento indicaba
-- menor, el guard del escritor paraba el acto y el profesional recibia un mensaje que lo mandaba al
-- camino del enlace, "y si el representante no tiene correo, avisale a quien administra Atlas: ese caso
-- aun no tiene salida". O sea: la via presencial existe PORQUE el paciente no tiene correo, y para un
-- menor sin correo no habia ninguna.
--
-- ── LA FECHA DE NACIMIENTO SUBE A LA EMISION DEL PASE, Y ES EL CAMBIO QUE MANDA ───────────────────
--
-- Antes se escribia al FINAL, cuando el paciente ya habia autorizado desde su telefono. Eso tiene tres
-- consecuencias, y las tres caen con este cambio:
--
--   1. EL TELEFONO NO PODIA SABER a quien pedirle los datos. Para un menor, el que autoriza es el
--      representante legal, asi que la pantalla del paciente tiene que decirlo ANTES de que alguien
--      marque nada, y para eso la edad tiene que estar decidida antes de mostrar el QR.
--   2. LA DECLARACION SE ELIGE POR EDAD (legal, 2026-10-12: 1.0 mayores, 1.1-a menores de 14, 1.1-b de
--      14 a 17). El profesional tiene que VER el texto que va a aceptar, asi que la version tiene que
--      estar fijada al emitir, no al declarar.
--   3. Y EL TRABAJO NO SE PIERDE: con la fecha al final, un menor completaba todo el acto en su telefono
--      para que el sistema lo frenara despues. Con la fecha al principio, la rama correcta se abre desde
--      el primer paso.
--
-- SE FIJA EN LA EMISION Y NO SE RECALCULA: `declaracion_version` ya existia y se escribia ahi con una
-- constante. Ahora se escribe con la version que corresponde a esa fecha, y es la MISMA que viaja a
-- `patient_consents.declaration_version`. Una sola fuente, asi que la pantalla y el registro no pueden
-- decir versiones distintas.
--
-- LA COLUMNA ES NULA PARA LAS VIEJAS, a proposito: hay sesiones emitidas antes de este cambio y
-- reescribirles una fecha seria inventar un dato del paciente. Una sesion sin fecha no se puede declarar
-- (lo dice la aplicacion con palabras, y manda a emitir el pase otra vez, que toma un segundo).
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LA FECHA DE NACIMIENTO DEL PACIENTE, ESCRITA AL EMITIR ───
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "patient_birth_date" date;--> statement-breakpoint

COMMENT ON COLUMN "presencial_consent_sessions"."patient_birth_date" IS
  'La fecha que el profesional leyo del documento al emitir el pase. Decide la rama de edad y con ella la version de la declaracion. NULA solo en sesiones anteriores al 2026-10-12, que no se pueden declarar.';--> statement-breakpoint

-- ─── 2. EL REPRESENTANTE LEGAL, ESCRITO POR EL EN EL TELEFONO ───
--
-- LOS ESCRIBE EL, no el profesional, y es la misma razon por la que el paciente escribe los suyos: el
-- dictamen pide que el acto sea "una manifestacion suya y no la aceptacion de datos que otro registro".
-- Para un menor, quien manifiesta es el representante.
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "representante_nombre" text;--> statement-breakpoint
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "representante_documento" text;--> statement-breakpoint
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "representante_parentesco" text;--> statement-breakpoint

-- EL CORREO ES OPCIONAL AQUI, Y SOLO AQUI. En el camino REMOTO es obligatorio porque el correo es por
-- donde va el codigo de verificacion: ahi el codigo ES la verificacion de identidad, asi que sin correo no
-- hay firma que sostener. En el presencial la identidad la verifica el profesional contra el documento,
-- con la persona delante, y esta via existe precisamente porque no hay correo. Exigirlo aqui cerraria la
-- unica puerta que esta pieza abre.
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "representante_email" text;--> statement-breakpoint

-- ─── 3. EL ASENTIMIENTO DEL MENOR DE 14 A 17 ───
--
-- NO ES UNA AUTORIZACION: la autorizacion la da el representante. Es el acto del menor, que el modelo
-- registra aparte y la declaracion 1.1-b afirma haber presenciado.
ALTER TABLE "presencial_consent_sessions"
  ADD COLUMN IF NOT EXISTS "asentimiento_menor" boolean;--> statement-breakpoint

-- ─── 4. LA COHERENCIA, EN LA BASE ───
--
-- Las tres cosas que no pueden pasar, y que un formulario no puede garantizar (la leccion de la 0181 y la
-- del propio hueco de los menores: "este hueco existio porque el formulario permitio guardar un estado
-- imposible, y mientras eso siga siendo posible va a volver a ocurrir POR OTRA VIA"):
--
--   a) una sesion CONFIRMADA de la rama menor sin los datos del representante. Confirmada significa que
--      alguien autorizo; si fue el representante, tiene que constar quien.
--   b) el asentimiento marcado en una version que NO lo afirma. La 1.1-a existe justamente porque para un
--      menor de 14 el profesional no puede declarar un asentimiento que no ocurrio; guardarlo en la fila
--      seria la misma afirmacion falsa por la puerta de al lado.
--   c) datos de representante en una sesion de la rama MAYOR. Ahi el que autoriza es el paciente, y un
--      representante colgando de esa fila contradice la declaracion 1.0, que afirma que marco el paciente.
ALTER TABLE "presencial_consent_sessions"
  DROP CONSTRAINT IF EXISTS "presencial_sessions_rama_de_edad_coherente";--> statement-breakpoint
ALTER TABLE "presencial_consent_sessions"
  ADD CONSTRAINT "presencial_sessions_rama_de_edad_coherente" CHECK (
    -- (a) confirmada y de la rama menor => representante completo
    (
      "confirmed_at" IS NULL
      OR "declaracion_version" NOT LIKE '1.1%'
      OR (
        "representante_nombre" IS NOT NULL
        AND "representante_documento" IS NOT NULL
        AND "representante_parentesco" IS NOT NULL
      )
    )
    -- (b) el asentimiento solo en la version que lo afirma
    AND ("asentimiento_menor" IS NOT TRUE OR "declaracion_version" = '1.1-b')
    -- (c) nada de representante en la rama mayor
    AND (
      "declaracion_version" LIKE '1.1%'
      OR (
        "representante_nombre" IS NULL
        AND "representante_documento" IS NULL
        AND "representante_parentesco" IS NULL
        AND "representante_email" IS NULL
      )
    )
  );
