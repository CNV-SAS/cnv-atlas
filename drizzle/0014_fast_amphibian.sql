CREATE TYPE "public"."access_grant_status" AS ENUM('pending', 'approved', 'denied', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."access_grant_type" AS ENUM('notes_pseudonymous', 'notes_identified');--> statement-breakpoint
CREATE TYPE "public"."access_reason_category" AS ENUM('auditoria_calidad', 'soporte_tecnico');--> statement-breakpoint
CREATE TABLE "clinical_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_type" "access_grant_type" NOT NULL,
	"reason_category" "access_reason_category" NOT NULL,
	"status" "access_grant_status" DEFAULT 'pending' NOT NULL,
	"requester_id" uuid NOT NULL,
	"approver_role" "app_role" NOT NULL,
	"approver_id" uuid,
	"resource_id" uuid,
	"reason" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinical_access_grants" ADD CONSTRAINT "clinical_access_grants_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_access_grants" ADD CONSTRAINT "clinical_access_grants_approver_id_profiles_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_access_grants" ADD CONSTRAINT "clinical_access_grants_resource_id_patients_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinical_access_grants_requester_idx" ON "clinical_access_grants" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "clinical_access_grants_status_idx" ON "clinical_access_grants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clinical_access_grants_resource_idx" ON "clinical_access_grants" USING btree ("resource_id");