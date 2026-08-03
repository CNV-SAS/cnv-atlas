CREATE TYPE "public"."correction_trigger_type" AS ENUM('correccion_profesional', 'recalibracion_ciencia');--> statement-breakpoint
CREATE TABLE "clinical_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_evaluation_id" uuid NOT NULL,
	"new_evaluation_id" uuid NOT NULL,
	"corrected_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"trigger_type" "correction_trigger_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clinical_corrections" ADD CONSTRAINT "clinical_corrections_old_evaluation_id_evaluations_id_fk" FOREIGN KEY ("old_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_corrections" ADD CONSTRAINT "clinical_corrections_new_evaluation_id_evaluations_id_fk" FOREIGN KEY ("new_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_corrections" ADD CONSTRAINT "clinical_corrections_corrected_by_profiles_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinical_corrections_old_idx" ON "clinical_corrections" USING btree ("old_evaluation_id");--> statement-breakpoint
CREATE INDEX "clinical_corrections_new_idx" ON "clinical_corrections" USING btree ("new_evaluation_id");--> statement-breakpoint
CREATE INDEX "evaluations_superseded_idx" ON "evaluations" USING btree ("superseded_at");