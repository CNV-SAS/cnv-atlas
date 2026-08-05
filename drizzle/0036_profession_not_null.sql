-- Gate Hito 2: la profesion de un profesional es obligatoria (se captura al invitar, ver createUser).
-- profession=null bloqueaba TODAS las escrituras de tratamiento del integrante. NO se auto-backfillea:
-- no hay una profesion por defecto segura (adivinar el atributo clinico de una persona seria peor que
-- fallar). Verificado 0 nulls antes de aplicar; si existiera un null, este ALTER falla FUERTE y se
-- resuelve a mano (decision explicita, no fabricada). Forward-only.
ALTER TABLE "professional_profiles" ALTER COLUMN "profession" SET NOT NULL;