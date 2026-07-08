ALTER TABLE "treatments" ADD COLUMN "kcal_objetivo" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "proteina_g" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "restricciones" text[] DEFAULT '{}'::text[] NOT NULL;