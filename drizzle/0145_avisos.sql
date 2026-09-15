-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS AVISOS  ·  Bloque A  ·  2026-09-15
--
-- EL PROBLEMA (Santiago, 2026-09-14): hoy nadie entra a /pagos a diario, y con mas de 50 Integrantes y cientos
-- de pedidos es inviable esperar que alguien lo mire. Un control que depende de que alguien entre no es un
-- control. Atlas avisa; no espera a que lo miren.
--
-- LAS DECISIONES (Santiago, 2026-09-15): correo diario (7 a. m. y 5 p. m.) SOLO si hay algo que requiere
-- accion; sin reintento automatico (ojo humano antes); a quien lo diga una MARCA en el usuario, que se pone a
-- admin, direccion o soporte; lo vencido va tambien a quien tenga la marca de escalamiento; "en gestion hasta"
-- para que el correo no repita lo que alguien ya esta mirando; y correo inmediato al Integrante cuando un pago
-- de su venta entra en revision.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. QUIEN RECIBE ─────────────────────────────────────────────────────────────────────────────────
-- Una marca por usuario y tipo. No es una variable de entorno ni un correo escrito en codigo: cambiar de
-- responsable es un clic del administrador.
CREATE TABLE IF NOT EXISTS "notification_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "created_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_subscriptions_kind_valido" CHECK ("kind" IN ('pendientes_ventas', 'escalamiento_ventas')),
  CONSTRAINT "notification_subscriptions_una_por_tipo" UNIQUE ("profile_id", "kind")
);--> statement-breakpoint

-- SOLO ROLES INTERNOS (admin, direccion, soporte). Lo exige la base y no solo la pantalla: un profesional con
-- la marca recibiria el efectivo no recibido de sus colegas.
CREATE OR REPLACE FUNCTION public.notification_subscription_rol_interno() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = NEW.profile_id AND r.name::text IN ('admin', 'direccion', 'soporte')
  ) THEN
    RAISE EXCEPTION 'La marca de avisos de ventas solo se pone a admin, direccion o soporte.';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "notification_subscriptions_rol_interno_trg" ON "notification_subscriptions";--> statement-breakpoint
CREATE TRIGGER "notification_subscriptions_rol_interno_trg"
  BEFORE INSERT OR UPDATE ON "notification_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION public.notification_subscription_rol_interno();--> statement-breakpoint

-- ── 2. "EN GESTION HASTA" ───────────────────────────────────────────────────────────────────────────
-- Quien mira un pendiente deja escrito que lo esta gestionando, por que, y hasta cuando no hace falta volver a
-- avisarle. Historial: la ultima fila de cada (tipo, venta) es la vigente, y las anteriores se quedan.
CREATE TABLE IF NOT EXISTS "pending_followups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "note" text NOT NULL,
  "until_date" date NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pending_followups_kind_valido" CHECK ("kind" IN ('revision', 'sin_documento', 'nota_credito')),
  CONSTRAINT "pending_followups_nota" CHECK (length(trim("note")) >= 5)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_followups_vigente_idx"
  ON "pending_followups" ("kind", "transaction_id", "created_at" DESC);--> statement-breakpoint

-- ── 3. CADA ENVIO DEL RESUMEN ───────────────────────────────────────────────────────────────────────
-- Para dos cosas: saber que es NUEVO (lo que no estaba en el envio anterior) y no mandar dos veces el mismo
-- (un dia y una franja, una sola fila). Se registra tambien cuando no se envio nada, con el motivo.
CREATE TABLE IF NOT EXISTS "alert_digest_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_date" date NOT NULL,
  "slot" text NOT NULL,
  "ran_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Las claves de TODO lo pendiente en ese momento ("revision:<id>"), aunque no se enviara.
  "item_keys" text[] DEFAULT '{}' NOT NULL,
  "sent" boolean NOT NULL,
  "reason" text,
  "recipients" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "alert_digest_runs_slot_valido" CHECK ("slot" IN ('am', 'pm')),
  CONSTRAINT "alert_digest_runs_uno_por_franja" UNIQUE ("run_date", "slot")
);--> statement-breakpoint

-- ── 4. EL AVISO AL INTEGRANTE, UNA VEZ ──────────────────────────────────────────────────────────────
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "review_notified_at" timestamp with time zone;--> statement-breakpoint

-- ── LECTURA ─────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "notification_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pending_followups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert_digest_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "notification_subscriptions_select" ON "notification_subscriptions";--> statement-breakpoint
CREATE POLICY "notification_subscriptions_select" ON "notification_subscriptions"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));--> statement-breakpoint
DROP POLICY IF EXISTS "pending_followups_select" ON "pending_followups";--> statement-breakpoint
CREATE POLICY "pending_followups_select" ON "pending_followups"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));--> statement-breakpoint
DROP POLICY IF EXISTS "alert_digest_runs_select" ON "alert_digest_runs";--> statement-breakpoint
CREATE POLICY "alert_digest_runs_select" ON "alert_digest_runs"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));
