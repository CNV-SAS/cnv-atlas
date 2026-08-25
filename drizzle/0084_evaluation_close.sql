-- CIERRE DE LA CONSULTA (2026-08-24). Hasta hoy nadie ponia el estado 'completed': 38 evaluaciones
-- abiertas y cero cerradas, y la columna Estado de la ficha del paciente ya tenia escrita la etiqueta
-- "Completada" esperando que algo pusiera el valor.
--
-- El cierre es un ACTO CLINICO y por eso deja quien y cuando, como cualquier otro. La lista de pendientes
-- NO se guarda: se deriva del estado real en cada render, asi que no puede quedar stale (un pendiente que
-- se resolvio despues del cierre deja de aparecer solo).
--
-- Es REVERSIBLE a proposito: cerrar es contabilidad de la consulta, no un sello clinico. Los sellos de
-- verdad (diagnostico confirmado, protocolo aprobado, reporte enviado) son inmutables y no dependen de
-- esto. Si hay que volver a tocar la evaluacion, reabrir la devuelve a 'in_progress'; ambos actos se
-- auditan. A diferencia de 'abandoned', que NO es reversible porque reabrirla reviviria el resume_token.
ALTER TABLE "evaluations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "closed_by" uuid;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_closed_by_profiles_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
