ALTER TABLE "evaluations" ADD COLUMN "identity_conflict" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "declared_first_name" text;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "declared_last_name" text;