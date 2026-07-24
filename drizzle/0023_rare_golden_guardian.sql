ALTER TYPE "public"."bis_condition_kind" ADD VALUE 'validez';--> statement-breakpoint
ALTER TABLE "bis_conditions" ADD COLUMN "compromises_validity" boolean DEFAULT false NOT NULL;