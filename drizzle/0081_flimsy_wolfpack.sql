CREATE TYPE "public"."contraindication_source" AS ENUM('descarte_nutraceutico', 'observacion_clinica');--> statement-breakpoint
CREATE TYPE "public"."nutraceutical_decision" AS ENUM('si', 'no', 'pendiente');--> statement-breakpoint
CREATE TYPE "public"."nutraceutical_decision_reason" AS ENUM('profesional_clinica', 'profesional_no_clinica', 'costo', 'lo_piensa', 'ya_toma_otros', 'otra');--> statement-breakpoint
CREATE TABLE "patient_contraindications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"nutraceutical_id" uuid,
	"source" "contraindication_source" NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "nutraceutical_decision" "nutraceutical_decision";--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "nutraceutical_decision_reason" "nutraceutical_decision_reason";--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "nutraceutical_decision_note" text;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "nutraceutical_decision_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "nutraceutical_decision_by" uuid;--> statement-breakpoint
ALTER TABLE "patient_contraindications" ADD CONSTRAINT "patient_contraindications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_contraindications" ADD CONSTRAINT "patient_contraindications_nutraceutical_id_nutraceuticals_id_fk" FOREIGN KEY ("nutraceutical_id") REFERENCES "public"."nutraceuticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_contraindications" ADD CONSTRAINT "patient_contraindications_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_contraindications_patient_idx" ON "patient_contraindications" USING btree ("patient_id");--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_nutraceutical_decision_by_profiles_id_fk" FOREIGN KEY ("nutraceutical_decision_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;