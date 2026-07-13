CREATE TYPE "public"."professional_document_type" AS ENUM('anexo3');--> statement-breakpoint
CREATE TABLE "professional_document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"document_type" "professional_document_type" NOT NULL,
	"signed_version" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_document_signatures_prof_doc_unique" UNIQUE("professional_id","document_type")
);
--> statement-breakpoint
ALTER TABLE "professional_document_signatures" ADD CONSTRAINT "professional_document_signatures_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_document_signatures_prof_idx" ON "professional_document_signatures" USING btree ("professional_id");