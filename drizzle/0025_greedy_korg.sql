CREATE TYPE "public"."treatment_status" AS ENUM('draft', 'approved');--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "protocol_suggested" jsonb;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "protocol_approved" jsonb;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_geb" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_pal" numeric;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_kcal_obj" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_prot_gkg" numeric;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_fat_pct" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "adj_peso_meta" numeric;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "status" "treatment_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "restrictions_ack_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "restrictions_ack_by" uuid;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "micronutrientes_texto" text;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "proxima_cita" date;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_restrictions_ack_by_profiles_id_fk" FOREIGN KEY ("restrictions_ack_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;