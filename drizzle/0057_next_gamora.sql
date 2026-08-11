ALTER TYPE "public"."evaluation_status" ADD VALUE 'awaiting_survey' BEFORE 'draft';--> statement-breakpoint
ALTER TYPE "public"."evaluation_status" ADD VALUE 'abandoned';--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "resume_token" text;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_resume_token_unique" UNIQUE("resume_token");