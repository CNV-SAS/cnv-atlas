-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS DOS DATOS DEL INTEGRANTE QUE ATLAS NO GUARDABA  ·  2026-09-25
--
-- Al armar la pestaña "Mis datos" del perfil se verifico que dato existia y que no. El registro profesional
-- ya estaba (`license`), el documento tambien (el tributario). Faltaban estos dos, que el integrante SI puede
-- editar porque son suyos y cambian: su celular y donde atiende.
--
-- ── POR QUE EL CONSULTORIO VA AQUI Y NO EN UNA TABLA DE SEDES ──
--
-- Porque hoy es un DATO DE CONTACTO, no una entidad. Una tabla de sedes tendria sentido si algo colgara de
-- ella (agenda por sede, inventario por sede, un profesional en dos sedes), y nada de eso existe ni esta
-- planeado. `inventory_locations` ya lleva DONDE ESTA SU PRODUCTO, que es la unica ubicacion que hoy gobierna
-- algo; esta es la direccion que va en un directorio y en la HC.
--
-- Si mañana hace falta la entidad, se migra el dato a ella. Crear la tabla ahora seria construir una relacion
-- para sostener un texto.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "phone" text,
  ADD COLUMN IF NOT EXISTS "office_address" text,
  ADD COLUMN IF NOT EXISTS "office_city" text;--> statement-breakpoint

COMMENT ON COLUMN "professional_profiles"."phone" IS
  'Celular del integrante. Lo edita el; no es el del paciente (eso vive en patient_contacts).';--> statement-breakpoint
COMMENT ON COLUMN "professional_profiles"."office_address" IS
  'Donde atiende. Dato de contacto, no una entidad: la ubicacion que gobierna inventario es inventory_locations.';
