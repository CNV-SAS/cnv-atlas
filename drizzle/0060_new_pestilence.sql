CREATE TYPE "public"."tax_person_type" AS ENUM('natural', 'juridica');--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_person_type" "tax_person_type";--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_has_rut" boolean;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_is_income_declarant" boolean;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_is_vat_responsible" boolean;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_id_number" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_must_invoice" boolean;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_status_completed_at" timestamp with time zone;