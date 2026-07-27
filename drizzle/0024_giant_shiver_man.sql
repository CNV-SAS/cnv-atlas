CREATE TYPE "public"."professional_profession" AS ENUM('medico', 'psicologo', 'deportologo', 'nutricionista');--> statement-breakpoint
ALTER TABLE "professional_profiles" RENAME COLUMN "specialty" TO "profession";--> statement-breakpoint
-- Endurecimiento manual (T2 A1): drizzle-kit sub-genera para text -> enum (emite el CREATE TYPE
-- y el RENAME, no el SET DATA TYPE ni la migracion de datos). Se agregan las dos lineas que
-- faltaban. El UPDATE mapea el texto libre a la etiqueta tipada ANTES del cast (hoy solo existe
-- 'Nutricion' del seed); un valor no mapeado hace fallar el cast a proposito (forward-only, sin
-- default silencioso). Verificado antes de escribir: la columna no tiene DEFAULT, ni vistas que
-- la referencien, ni CHECK constraints (los tres harian fallar el SET DATA TYPE a mitad).
UPDATE "professional_profiles" SET "profession" = 'nutricionista' WHERE "profession" ILIKE 'nutricion%';--> statement-breakpoint
ALTER TABLE "professional_profiles" ALTER COLUMN "profession" SET DATA TYPE "public"."professional_profession" USING "profession"::"public"."professional_profession";
