CREATE TYPE "public"."nutraceutical_faltante_charge" AS ENUM('sin_cargo', 'pendiente_liquidacion', 'liquidado');--> statement-breakpoint
CREATE TYPE "public"."nutraceutical_faltante_justification" AS ENUM('hurto_denuncia', 'transporte_documentado', 'venta_no_registrada', 'devolucion_guia');--> statement-breakpoint
CREATE TYPE "public"."nutraceutical_faltante_status" AS ENUM('reportado', 'en_revision', 'justificado', 'venta_no_registrada', 'injustificado_pendiente', 'injustificado');--> statement-breakpoint
CREATE TABLE "nutraceutical_faltante_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"nutraceutical_id" uuid NOT NULL,
	"lote" text,
	"quantity" integer NOT NULL,
	"sealed_unit_price" numeric NOT NULL,
	"sealed_total" numeric NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"justification_category" "nutraceutical_faltante_justification",
	"justification_reference" text,
	"status" "nutraceutical_faltante_status" DEFAULT 'reportado' NOT NULL,
	"charge_status" "nutraceutical_faltante_charge" DEFAULT 'sin_cargo' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutraceutical_faltante_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"from_status" "nutraceutical_faltante_status",
	"to_status" "nutraceutical_faltante_status" NOT NULL,
	"justification_category" "nutraceutical_faltante_justification",
	"justification_reference" text,
	"reason" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases" ADD CONSTRAINT "nutraceutical_faltante_cases_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases" ADD CONSTRAINT "nutraceutical_faltante_cases_nutraceutical_id_nutraceuticals_id_fk" FOREIGN KEY ("nutraceutical_id") REFERENCES "public"."nutraceuticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases" ADD CONSTRAINT "nutraceutical_faltante_cases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_transitions" ADD CONSTRAINT "nutraceutical_faltante_transitions_case_id_nutraceutical_faltante_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."nutraceutical_faltante_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_transitions" ADD CONSTRAINT "nutraceutical_faltante_transitions_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutra_faltante_prof_idx" ON "nutraceutical_faltante_cases" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "nutra_faltante_status_idx" ON "nutraceutical_faltante_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nutra_faltante_trans_case_idx" ON "nutraceutical_faltante_transitions" USING btree ("case_id");