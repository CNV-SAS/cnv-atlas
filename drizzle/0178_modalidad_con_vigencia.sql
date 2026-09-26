-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA MODALIDAD DEL INTEGRANTE, CON VIGENCIA  ·  2026-09-25
--
-- Decision de Santiago: la modalidad SE CONSTRUYE, no solo se registra. Que admin pueda cambiar a un
-- profesional de Comision a Distribucion y que el cambio MANDE, aunque todavia no se habilite a nadie.
--
-- Hasta hoy `transaction_items.modality` existia y el escritor la sellaba SIEMPRE como 'comision': era un
-- espacio reservado, no un dato. Esta migracion la convierte en un hecho del integrante, y el sellado la lee.
--
-- ── POR QUE CON VIGENCIA Y NO UNA COLUMNA  (es lo que decide todo el diseño) ──
--
-- Porque el modelo comercial (§2, "Cambio de modalidad") dice: *"El cambio surte efecto al inicio del
-- siguiente periodo de corte. El periodo en curso se cierra bajo la modalidad anterior, PARA NO PARTIR UNA
-- LIQUIDACION EN DOS REGIMENES."*
--
-- Una columna `modality` no puede cumplir eso: al cambiarla, las ventas ya hechas del periodo en curso
-- quedarian leyendose bajo el regimen nuevo, que es exactamente partir la liquidacion en dos. Con vigencia, la
-- venta de ayer sigue siendo de la modalidad de ayer, y la de mañana es de la nueva. Es la MISMA forma que ya
-- usa `professional_commission_rates` y por la misma razon: "¿bajo que regimen se liquido esto?" necesita una
-- respuesta CON FECHA.
--
-- Y por eso `valid_from` NO es la fecha del cambio: es el INICIO DEL SIGUIENTE CORTE, que lo calcula
-- `src/modules/payments/modalidad.ts` (modulo puro, con su candado) porque el corte no es el mismo en las dos
-- modalidades: Comision liquida MENSUAL (§3) y Distribucion corta QUINCENAL (§4).
--
-- ── SIN FILA = COMISION ──
--
-- Ningun integrante existente necesita backfill: la ausencia de fila significa Comision, que es lo que todos
-- son hoy y lo que el escritor sellaba a mano. Asi el cambio no reescribe nada de lo ya vendido.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "professional_modalities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
  "modality" text NOT NULL,
  -- INICIO DEL CORTE en que empieza a regir, no la fecha en que admin pulso el boton.
  "valid_from" date NOT NULL,
  -- null = vigente. Cerrar una vigencia es poner fecha aqui e insertar la nueva.
  "valid_to" date,
  -- QUIEN LO DECIDIO Y CUANDO LO PIDIO. La fecha de la decision es distinta de `valid_from` a proposito: una
  -- es cuando se tomo y la otra cuando empieza a regir, y confundirlas es lo que hace irreconstruible un
  -- cambio de regimen.
  "decided_by" uuid REFERENCES "profiles"("id"),
  "decided_at" timestamptz NOT NULL DEFAULT now(),
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "professional_modalities_valida" CHECK ("modality" IN ('comision', 'distribucion')),
  CONSTRAINT "professional_modalities_vigencia_coherente"
    CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);--> statement-breakpoint

-- UNA SOLA VIGENTE POR PROFESIONAL, garantizada por la BASE y no por la aplicacion. Mismo mecanismo que
-- `pcr_una_vigente_por_profesional`: dos vigentes harian que "su modalidad" tuviera dos respuestas, y el
-- sellado de una venta elegiria una cualquiera.
CREATE UNIQUE INDEX IF NOT EXISTS "prof_modalidad_una_vigente"
  ON "professional_modalities" ("professional_id")
  WHERE "valid_to" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "prof_modalidad_prof_idx"
  ON "professional_modalities" ("professional_id", "valid_from" DESC);--> statement-breakpoint

-- ── LOS REQUISITOS DE DISTRIBUCION (§2 del modelo) ──
--
-- NO SE VALIDAN EN LA BASE, y es deliberado: son requisitos de NEGOCIO que CNV verifica (facturador
-- electronico habilitado ante la DIAN, cupo aceptado, estar al dia), y dos de ellos Atlas no los sabe. Un
-- CHECK que solo pudiera comprobar uno daria la falsa impresion de que la base los garantiza todos.
--
-- Lo que SI se guarda es que admin los verifico, con su fecha, para que quede el rastro de la habilitacion.
ALTER TABLE "professional_modalities"
  ADD COLUMN IF NOT EXISTS "requisitos_verificados_at" timestamptz;--> statement-breakpoint

COMMENT ON TABLE "professional_modalities" IS
  'Modalidad del integrante CON VIGENCIA (modelo comercial §2): el cambio rige desde el inicio del siguiente corte, para no partir una liquidacion en dos regimenes. Sin fila = comision.';
