CREATE TYPE "public"."nutraceutical_availability" AS ENUM('en_consultorio', 'solo_tienda', 'no_disponible');--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "indication" text;--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "composition" text;--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "presentation" text;--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "serving_size" text;--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "sanitary_registration" text;--> statement-breakpoint
ALTER TABLE "nutraceuticals" ADD COLUMN "commercial_availability" "nutraceutical_availability" DEFAULT 'no_disponible' NOT NULL;