-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS ADJUNTOS DEL INTEGRANTE, CON HISTORIAL  ·  2026-09-25
--
-- Hasta hoy el RUT era UNA RUTA en la fila del profesional (`rut_path`): subir uno nuevo PISABA la del
-- anterior. El archivo viejo podia quedar en el bucket, pero nada lo relacionaba ni lo listaba, asi que no
-- habia historial que mostrar. Santiago pidio verlo, con el vigente y los anteriores.
--
-- ── GENERICA Y NO "rut_versions", como recomendamos y Santiago aprobo ──
--
-- Precedente en la casa: `professional_document_signatures` se hizo generica desde el principio aunque solo
-- usara 'anexo3', y hoy no hay que migrarla para el resto de la gestion documental. Misma apuesta: el RUT es
-- el primer adjunto, no el unico (certificado bancario, RUP, diploma, tarjeta profesional).
--
-- ── `rut_path` SE QUEDA, y no es duplicidad ──
--
-- Es el CACHE del vigente, y lo leen el gate de la liquidacion, la cola de verificacion y la ruta /rut/[id].
-- Moverlos todos a una subconsulta seria un barrido grande para no ganar nada: aqui la fuente de verdad es
-- esta tabla y esa columna es su proyeccion, igual que `nutraceutical_inventory.stock_quantity` frente a sus
-- movimientos. Lo que NO puede pasar es que discrepen, y por eso el escritor de adjuntos es el mismo que
-- actualiza la columna, en la misma transaccion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "professional_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
  -- Que documento es. Texto y no enum: un enum obliga a migrar para admitir un tipo nuevo, y el punto de
  -- esta tabla es no volver a migrar. El CHECK acota lo conocido y se amplia con un ALTER de una linea.
  "kind" text NOT NULL,
  -- Ruta en el bucket privado professional-documents. NO es una URL publica.
  "path" text NOT NULL,
  "original_name" text,
  "content_type" text,
  "size_bytes" integer,
  -- LA FECHA QUE TRAE EL DOCUMENTO, distinta de cuando se subio: el RUT envejece (si tiene mas de un año se
  -- pide actualizado), y eso se mide por la del documento, no por la de la carga.
  "document_date" date,
  "uploaded_by" uuid REFERENCES "profiles"("id"),
  "uploaded_at" timestamptz NOT NULL DEFAULT now(),
  -- REEMPLAZADO POR OTRO, con su fecha. No se borra: el historial es el punto.
  "superseded_at" timestamptz,
  "superseded_by" uuid REFERENCES "professional_attachments"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "professional_attachments_kind_valido"
    CHECK ("kind" IN ('rut', 'certificado_bancario', 'tarjeta_profesional', 'diploma', 'otro')),
  -- Un adjunto reemplazado tiene que decir POR CUAL. Sin esto, "superseded_at sin superseded_by" seria un
  -- adjunto retirado sin sucesor, que es distinto de reemplazado y no es lo que esta tabla modela.
  CONSTRAINT "professional_attachments_reemplazo_completo"
    CHECK (("superseded_at" IS NULL) = ("superseded_by" IS NULL))
);--> statement-breakpoint

-- UNO VIGENTE POR (profesional, tipo), garantizado por la base: dos RUT vigentes harian que "su RUT" tuviera
-- dos respuestas, que es justo el problema que esta tabla viene a cerrar.
CREATE UNIQUE INDEX IF NOT EXISTS "prof_adjunto_uno_vigente_por_tipo"
  ON "professional_attachments" ("professional_id", "kind")
  WHERE "superseded_at" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "prof_adjunto_prof_idx"
  ON "professional_attachments" ("professional_id", "uploaded_at" DESC);--> statement-breakpoint

COMMENT ON TABLE "professional_attachments" IS
  'Adjuntos del integrante con historial. El vigente de cada tipo es el que tiene superseded_at nulo; professional_profiles.rut_path es su cache para el RUT.';
