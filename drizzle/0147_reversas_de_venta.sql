-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA REVERSA DE UNA VENTA  ·  Bloque 3b, sesion 1  ·  2026-09-16
--
-- QUE ES: un contracargo (el paciente desconoce el pago ante su banco) o una anulacion de Wompi sobre una venta
-- ya pagada. NO es un campo mas en la venta: es un CASO que dura dias y cambia de estado, como el faltante.
--
-- LOS TRES ESTADOS, Y POR QUE (contabilidad, 2026-09-16). Separan el efecto de CAJA del de RESULTADO:
--   · ABIERTA: el banco ya debito, y eso es un hecho que se registra. Pero el INGRESO NO SE TOCA: la disputa se
--     puede ganar, y la factura sigue siendo valida mientras viva.
--   · GANADA: el banco repone. Se cierra sin efecto economico; el ingreso nunca se movio.
--   · PERDIDA: ahi si. Se revierte el ingreso y la comision con filas negativas, y queda pendiente la nota
--     credito manual en Alegra, con su plazo contando desde LA RESOLUCION, no desde la apertura.
--
-- EL MONTO DEBITADO VA APARTE DEL DE LA VENTA, y casi nunca coinciden: la franquicia suele cobrar una cuota de
-- manejo de la disputa, y la comision de Wompi no se devuelve. Esa diferencia es GASTO de CNV, no menor ingreso,
-- y por eso LA NOTA CREDITO SE EMITE SOLO POR EL VALOR DE LA VENTA.
--
-- Y SE GUARDA SI EL PRODUCTO ERA DE TERCERO: un contracargo perdido sobre un producto de tercero deja a CNV
-- devolviendo el total habiendo pagado ya al proveedor. Registrarlo es lo que permite reclamarselo despues.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "sale_reversals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "state" text DEFAULT 'abierta' NOT NULL,
  -- La referencia de la disputa en Wompi o en el banco, para poder seguirla por fuera de Atlas.
  "dispute_reference" text,
  -- Lo que el banco debito de verdad, y cuando. Puede ser MAYOR que la venta (cuota de manejo de la disputa).
  "debited_amount" numeric(12, 2),
  "debited_at" date,
  -- Si lo vendido era propio o de tercero, congelado al abrir el caso.
  "product_ownership" text NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- NULL cuando la abrio Atlas solo (un VOIDED que llego por webhook o por el cotejo).
  "opened_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "note" text,
  -- LA RESOLUCION MUEVE DINERO, asi que queda escrito quien, cuando y con que sustento (regla de la revision).
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "resolution_reference" text,
  -- La nota credito la hace contabilidad a mano en Alegra; Direccion escribe aqui su numero.
  "credit_note_manual_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sale_reversals_kind_valido" CHECK ("kind" IN ('contracargo', 'anulacion_wompi')),
  CONSTRAINT "sale_reversals_estado_valido" CHECK ("state" IN ('abierta', 'ganada', 'perdida')),
  CONSTRAINT "sale_reversals_propiedad_valida" CHECK ("product_ownership" IN ('propio', 'tercero', 'mixto', 'desconocido')),
  -- CERRAR ES TODO O NADA: sin quien y cuando, la plata se movio sin responsable.
  CONSTRAINT "sale_reversals_cierre_completo" CHECK (
    ("state" = 'abierta' AND "resolved_at" IS NULL AND "resolved_by" IS NULL)
    OR ("state" <> 'abierta' AND "resolved_at" IS NOT NULL AND "resolved_by" IS NOT NULL)
  ),
  -- La nota credito es de lo PERDIDO: emitirla sobre una disputa viva anularia una factura valida.
  CONSTRAINT "sale_reversals_nota_credito_solo_si_perdida" CHECK (
    "credit_note_manual_number" IS NULL OR "state" = 'perdida'
  )
);--> statement-breakpoint

-- UNA SOLA REVERSA ABIERTA POR VENTA: dos casos vivos sobre la misma venta revertirian el ingreso dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS "sale_reversals_una_abierta_por_venta"
  ON "sale_reversals" ("transaction_id") WHERE "state" = 'abierta';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sale_reversals_estado_idx" ON "sale_reversals" ("state", "opened_at" DESC);--> statement-breakpoint

-- ── LA COLA DE PENDIENTES DEL BLOQUE A ACEPTA LAS REVERSAS ─────────────────────────────────────────
-- Dos plazos distintos, y la razon de cada uno:
--   · ABIERTA: responderle al banco. Una disputa sin respuesta a tiempo SE PIERDE POR SILENCIO (contabilidad,
--     2026-09-16), asi que el aviso no espera: 3 dias habiles desde que se abre.
--   · PERDIDA SIN NOTA CREDITO: 5 dias habiles desde la RESOLUCION.
ALTER TABLE "pending_followups" DROP CONSTRAINT IF EXISTS "pending_followups_kind_valido";--> statement-breakpoint
ALTER TABLE "pending_followups" ADD CONSTRAINT "pending_followups_kind_valido"
  CHECK ("kind" IN ('revision', 'sin_documento', 'nota_credito', 'reversa'));--> statement-breakpoint

-- ── LECTURA ─────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "sale_reversals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "sale_reversals_select" ON "sale_reversals";--> statement-breakpoint
CREATE POLICY "sale_reversals_select" ON "sale_reversals"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));
