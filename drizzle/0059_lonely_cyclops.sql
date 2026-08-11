CREATE TYPE "public"."payment_method" AS ENUM('wompi', 'efectivo');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_method" "payment_method" DEFAULT 'wompi' NOT NULL;