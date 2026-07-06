ALTER TYPE "public"."consent_type_enum" ADD VALUE 'representante_legal';--> statement-breakpoint
ALTER TYPE "public"."consent_type_enum" ADD VALUE 'asentimiento_menor';--> statement-breakpoint
ALTER TABLE "patient_consents" ADD COLUMN "legal_representative_name" text;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD COLUMN "legal_representative_document" text;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD COLUMN "legal_representative_relationship" text;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD COLUMN "legal_representative_email" text;