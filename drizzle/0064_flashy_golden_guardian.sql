ALTER TABLE "professional_profiles" ADD COLUMN "rut_rejected_reason" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_rut_rejected_by_profiles_id_fk" FOREIGN KEY ("rut_rejected_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;