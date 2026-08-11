CREATE TYPE "public"."bank_account_type" AS ENUM('ahorros', 'corriente');--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "tax_id_dv" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_path" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_document_date" date;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "rut_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "bank_account_type" "bank_account_type";--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "bank_account_holder_name" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD COLUMN "bank_account_holder_document" text;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_rut_verified_by_profiles_id_fk" FOREIGN KEY ("rut_verified_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;