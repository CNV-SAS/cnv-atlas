CREATE TYPE "public"."nutraceutical_movement_type" AS ENUM('remesa', 'recepcion', 'despacho', 'conciliacion', 'devolucion');--> statement-breakpoint
CREATE TABLE "nutraceutical_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"nutraceutical_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"type" "nutraceutical_movement_type" NOT NULL,
	"reason" text,
	"treatment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- El inventario pasa de GLOBAL (una fila por producto) a POR PROFESIONAL (consignacion). Las filas
-- globales existentes no encajan en el modelo nuevo y son datos DEMO de pre-lanzamiento (Atlas aun no
-- tiene inventario real): se borran para que el ADD COLUMN NOT NULL aplique. El seed las recrea POR
-- PROFESIONAL via movimientos de recepcion (backfill del stock demo, smoke conservado). En produccion
-- no hay filas de inventario todavia, asi que este DELETE no afecta nada.
DELETE FROM "nutraceutical_inventory";--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ADD COLUMN "professional_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ADD CONSTRAINT "nutraceutical_stock_movements_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ADD CONSTRAINT "nutraceutical_stock_movements_nutraceutical_id_nutraceuticals_id_fk" FOREIGN KEY ("nutraceutical_id") REFERENCES "public"."nutraceuticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ADD CONSTRAINT "nutraceutical_stock_movements_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ADD CONSTRAINT "nutraceutical_stock_movements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutra_movements_prof_nutra_idx" ON "nutraceutical_stock_movements" USING btree ("professional_id","nutraceutical_id");--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ADD CONSTRAINT "nutraceutical_inventory_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ADD CONSTRAINT "nutra_inventory_prof_nutra_unique" UNIQUE("professional_id","nutraceutical_id");