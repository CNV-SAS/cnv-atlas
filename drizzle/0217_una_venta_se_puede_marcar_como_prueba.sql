-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA VENTA SE PUEDE MARCAR COMO PRUEBA, CON SU MOTIVO  ·  2026-10-12
--
-- ═══ EL HUECO QUE CIERRA, Y ES EL UNICO QUE LE FALTABA A LA ARQUITECTURA ═══
--
-- La 0203 hizo que una venta sepa si es de prueba, en un solo sitio, derivandolo de TRES marcas: el
-- profesional, el paciente y el producto. Catorce lectores leen esa columna, y por eso funciona.
--
-- PERO LA MARCA SE DERIVA DE QUIEN Y DE QUE, NUNCA DEL ACTO. Un profesional REAL vendiendole un producto
-- REAL a un paciente REAL, como prueba, no tiene de donde derivarse. Y es un caso real, no teorico:
--
--   · la venta de ADAPTO-STRESS que Santiago registro para probar el flujo;
--   · y la de LUVIA a una paciente real, que (textual suyo) *"nunca lo habiamos podido borrar ni ocultar"*.
--
-- MARCAR EL PRODUCTO NO SIRVE: ADAPTO-STRESS y LUVIA son los productos reales que se venden, y ademas la
-- base solo admite `is_test` en productos propios. Marcar al paciente tampoco: es una paciente real y la
-- marca le arrastraria TODA su historia, incluida la clinica.
--
-- ── ASI QUE ES UNA CUARTA ENTRADA DE LA MISMA DERIVACION, NO UN FILTRO NUEVO ──
--
-- Esta es la decision de diseño, y es la razon de que esto sean treinta lineas y no un barrido: la columna
-- `cuenta_como_de_prueba` sigue siendo la UNICA respuesta a "¿esta venta cuenta?", y los catorce lectores
-- no se tocan. Lo que cambia es que ahora tiene cuatro insumos en vez de tres.
--
-- Un filtro nuevo en cada lector seria exactamente el defecto que la 0203 existe para cerrar: *"en dos
-- semanas, seis veces el mismo defecto: dos pantallas de la misma cifra, el filtro en una y no en la otra"*.
--
-- ── EL MOTIVO ES OBLIGATORIO, como en el descarte de un pendiente y en la reversa de una venta ──
--
-- Porque esta marca no se deriva de nada: la pone una persona, y es la unica de las cuatro de la que se
-- puede preguntar "¿por que esta venta no cuenta?" sin que el sistema pueda responder solo. Sin motivo, la
-- respuesta en seis meses seria "porque alguien la marco", que no es una respuesta.
--
-- ── LO QUE ESTA MARCA NO HACE, Y HAY QUE DECIRLO ──
--
-- NO DEVUELVE LA UNIDAD AL ESTANTE. Los movimientos de inventario son inmutables a proposito: describen
-- algo que PASO, y la unidad salio de verdad. La correccion fisica es un movimiento de `conciliacion` por
-- ubicacion, con su motivo, que es otro acto y lo registra otra persona.
--
-- Y NO SACA EL AVISO DE "COBRADA SIN SALDO", tampoco por descuido: esa rama mira el PRODUCTO, porque habla
-- de UNIDADES FISICAS y las unidades no entienden de marcas (la razon esta escrita en
-- `avisos-repository.ts`). Si el producto era real, la vitrina esta descuadrada DE VERDAD. Lo que cierra ese
-- aviso es la conciliacion, o descartarlo con su motivo; no esta marca.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LAS TRES COLUMNAS DEL ACTO ───
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "marcada_como_prueba_at" timestamptz;--> statement-breakpoint
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "marcada_como_prueba_por" uuid REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "marcada_como_prueba_motivo" text;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."marcada_como_prueba_at" IS
  'Una persona marco ESTA venta como prueba. Es la cuarta entrada de cuenta_como_de_prueba, para el caso que no se puede derivar: profesional, paciente y producto reales, acto de prueba.';--> statement-breakpoint

-- LAS TRES VAN JUNTAS, y el motivo tiene cuerpo: un motivo de tres letras es el mismo vacio con mas pasos.
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_marca_de_prueba_con_motivo";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_marca_de_prueba_con_motivo" CHECK (
    ("marcada_como_prueba_at" IS NULL) = ("marcada_como_prueba_por" IS NULL)
    AND ("marcada_como_prueba_at" IS NULL) = ("marcada_como_prueba_motivo" IS NULL)
    AND ("marcada_como_prueba_motivo" IS NULL OR length(btrim("marcada_como_prueba_motivo")) >= 10)
  );--> statement-breakpoint

-- ─── 2. LA DERIVACION SUMA LA CUARTA ENTRADA ───
-- Se reescribe la funcion COMPLETA (no se parchea) para que la regla siga leyendose entera en un sitio.
CREATE OR REPLACE FUNCTION public.recomputar_venta_de_prueba(p_tx uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE transactions t
     SET cuenta_como_de_prueba = (
           -- (1) LA MARCA MANUAL DE ESTA VENTA. Va primera porque es la unica que habla del ACTO: las otras
           -- tres hablan de QUIEN o de QUE.
           t.marcada_como_prueba_at IS NOT NULL
           -- (2) El profesional es una cuenta de demostracion: nada de lo que pasa por sus manos cuenta.
           OR EXISTS (
             SELECT 1 FROM professional_profiles pp
              WHERE pp.id = t.professional_id AND COALESCE(pp.is_test, false)
           )
           -- (3) El paciente cuenta como de prueba (marcado o derivado, 0202).
           OR EXISTS (
             SELECT 1 FROM patients pa
              WHERE pa.id = t.patient_id AND COALESCE(pa.cuenta_como_de_prueba, false)
           )
           -- (4) Alguna linea es de un producto de prueba (y no pueden mezclarse: lo impide el servicio).
           OR EXISTS (
             SELECT 1 FROM transaction_items ti
               JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
              WHERE ti.transaction_id = t.id AND COALESCE(n.is_test, false)
           )
         )
   WHERE t.id = p_tx;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.recomputar_venta_de_prueba(uuid) FROM anon, authenticated;--> statement-breakpoint

-- ─── 3. Y EL DISPARADOR ESCUCHA LA COLUMNA NUEVA ───
-- SIN ESTO LA MARCA NO HARIA NADA, y es el defecto mas facil de dejar: la columna se escribe, el CHECK pasa,
-- nadie falla, y la venta sigue contando. Es la forma exacta de "una pieza terminada sin el ultimo cable".
DROP TRIGGER IF EXISTS "transactions_recomputa_marca" ON "transactions";--> statement-breakpoint
CREATE TRIGGER "transactions_recomputa_marca"
  AFTER INSERT OR UPDATE OF "professional_id", "patient_id", "marcada_como_prueba_at" ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_propia();--> statement-breakpoint

-- ─── 4. NO HACE FALTA BACKFILL ───
-- Ninguna fila tiene la columna nueva, asi que la derivacion de todas sigue dando lo mismo que daba. Se dice
-- en vez de omitirse, porque un backfill ausente sin explicacion se lee como un olvido.

COMMENT ON COLUMN "transactions"."cuenta_como_de_prueba" IS
  'DERIVADA por trigger, CUATRO insumos: la marca manual de esta venta, o profesional, paciente o producto de prueba. Es la unica respuesta a si esta venta cuenta.';
