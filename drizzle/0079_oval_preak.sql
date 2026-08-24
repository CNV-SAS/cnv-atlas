-- RESIDENCIA PROLONGADA: se retira la columna de las dos tablas.
--
-- Gildardo, 2026-08-23: "Retirenla definitivamente. No la parametrice nunca y no va. Lo que interesa es
-- donde esta la persona al momento de hacer la encuesta, que es lo que la ciudad actual ya captura."
--
-- POR QUE SE PUEDE BORRAR Y NO SOLO DEJAR DE ESCRIBIR: la pregunta nunca llego a produccion (se retiro del
-- formulario antes, siguiendo su regla de que la encuesta no se adelanta al archivo), asi que la columna
-- solo pudo recibir datos de prueba. Si en la nube tuviera algo, seria de un paciente demo. Es la excepcion,
-- no la regla: una columna con datos clinicos reales NO se borra, se deja de usar.
ALTER TABLE "patient_profiles" DROP COLUMN "longest_residence_city";--> statement-breakpoint
ALTER TABLE "evaluations" DROP COLUMN "longest_residence_city";
