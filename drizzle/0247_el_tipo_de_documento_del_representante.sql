-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL TIPO DE DOCUMENTO DEL REPRESENTANTE LEGAL  ·  2026-11-19
--
-- ═══ POR QUE HACE FALTA ═══
--
-- Contabilidad, 2026-11-18 (C1): la factura de un paciente MENOR va a nombre de su REPRESENTANTE LEGAL,
-- que es quien compra y quien paga, con su documento y su correo. Nunca los datos del menor en un
-- documento tributario, y nada de "consumidor final" por defecto.
--
-- Para crear ese contacto, Alegra exige `identificationObject.type` ademas del numero: alimenta el
-- documento electronico ante la DIAN, y es uno de los campos que hizo fallar el primer smoke con un 400.
--
-- Y `legal_representative_document` (de la 0008) es TEXTO LIBRE, SIN TIPO. Suponer "CC" seria inventar un
-- dato tributario de una persona real: un representante con cedula de extranjeria saldria con el tipo
-- equivocado en un documento que va a la DIAN, y eso se ve igual que uno bueno.
--
-- ═══ POR QUE REUSA EL ENUM `document_type` Y NO CREA UNO NUEVO ═══
--
-- Es el mismo vocabulario que ya viaja a Alegra: el camino del paciente adulto pasa
-- `patients.document_type` TAL CUAL a `identificationObject.type`, y funciona (hay facturas emitidas en
-- el sandbox con el). Un enum propio obligaria a traducir entre dos listas, y una traduccion es donde se
-- pierde un valor sin que nadie lo note.
--
-- ═══ Y POR QUE UN CHECK QUE DEJA FUERA 'TI' Y 'NIT' ═══
--
-- El enum tiene cinco valores y solo TRES pueden ser los de un representante legal:
--
--   · CC  cedula de ciudadania
--   · CE  cedula de extranjeria
--   · PA  pasaporte
--
-- 'TI' es la tarjeta de identidad, que es el documento DE UN MENOR: un representante con TI seria un
-- menor representando a otro menor. Y 'NIT' es de persona JURIDICA: el representante legal de un menor es
-- una persona natural, y un NIT aqui haria que el contacto se creara como LEGAL_ENTITY, que es falso.
--
-- Los dos errores producen un documento fiscal VALIDO y EQUIVOCADO, que es la clase de error que este
-- proyecto frena antes y no despues.
--
-- ═══ EL TIPO SOLO EXISTE DONDE EXISTE EL REPRESENTANTE ═══
--
-- Una fila de `patient_consents` que no es 'representante_legal' no tiene representante, asi que tampoco
-- puede tener su tipo de documento. Sin esta mitad, un tipo colgando de una autorizacion de un adulto
-- diria que ese adulto tiene representante.
--
-- NO SE RELLENA NADA HACIA ATRAS. Las filas que ya existen quedan con el tipo en NULO, y eso es
-- exactamente lo que se quiere que pase: significa "no lo sabemos", y la facturacion lo trata como dato
-- incompleto (la venta queda pendiente de facturar con su motivo, no se factura al menor). Poner 'CC' a
-- todas por defecto seria inventar el dato de golpe para todos.
--
-- ═══ COMO SE APLICA ═══
--
--   node --env-file=.env.production.local scripts/aplicar-migracion.mjs drizzle/0247_el_tipo_de_documento_del_representante.sql
--
-- Sin `--commit` hace el ENSAYO (corre todo y revierte). Con `--commit` al final, lo aplica de verdad.
-- `--commit` es la bandera REAL: cualquier otra se ignora en silencio y el script dice que todo salio
-- bien sin haber guardado nada.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patient_consents"
  ADD COLUMN IF NOT EXISTS "legal_representative_document_type" "document_type";--> statement-breakpoint

COMMENT ON COLUMN "patient_consents"."legal_representative_document_type" IS
  'Tipo de documento del representante legal (CC | CE | PA). Viaja a Alegra como identificationObject.type al facturar a nombre del representante de un paciente menor. NULO = no se sabe, y entonces la venta queda pendiente de facturar: nunca se factura al menor.';--> statement-breakpoint

-- Las dos reglas en una sola restriccion, porque son la misma afirmacion: este tipo pertenece a un
-- representante legal, y un representante legal es una persona natural adulta.
ALTER TABLE "patient_consents"
  DROP CONSTRAINT IF EXISTS "patient_consents_tipo_de_documento_del_representante";--> statement-breakpoint
ALTER TABLE "patient_consents"
  ADD CONSTRAINT "patient_consents_tipo_de_documento_del_representante" CHECK (
    "legal_representative_document_type" IS NULL
    OR (
      "consent_type" = 'representante_legal'
      AND "legal_representative_document_type" IN ('CC', 'CE', 'PA')
    )
  );--> statement-breakpoint

-- ── VERIFICACION, para leer en el ensayo ────────────────────────────────────────────────────────
--
-- Cuantas autorizaciones de representante hay hoy, y cuantas quedan sin tipo. Las que quedan sin tipo son
-- las que hay que completar desde la ficha del paciente, y son justo las que no se van a facturar hasta
-- completarlas.
DO $$
DECLARE
  v_total int;
  v_sin_tipo int;
  v_sin_documento int;
BEGIN
  SELECT count(*) INTO v_total
    FROM patient_consents
   WHERE consent_type = 'representante_legal' AND revoked_at IS NULL;

  SELECT count(*) INTO v_sin_tipo
    FROM patient_consents
   WHERE consent_type = 'representante_legal' AND revoked_at IS NULL
     AND legal_representative_document_type IS NULL;

  SELECT count(*) INTO v_sin_documento
    FROM patient_consents
   WHERE consent_type = 'representante_legal' AND revoked_at IS NULL
     AND coalesce(trim(legal_representative_document), '') = '';

  RAISE NOTICE 'Autorizaciones de representante legal vigentes: %', v_total;
  RAISE NOTICE '  sin TIPO de documento (hay que completarlas en la ficha): %', v_sin_tipo;
  RAISE NOTICE '  sin NUMERO de documento: %', v_sin_documento;
END $$;
