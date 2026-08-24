-- REENVIO del mismo reporte (2026-08-24). Hasta hoy un reporte ENVIADO no se podia reenviar: el servicio
-- corta con status != 'approved', asi que un correo perdido o una direccion mal escrita obligaban a
-- rehacer la evaluacion entera. Reenviar NO es reemitir: el snapshot, las notas y la trayectoria siguen
-- congelados; lo que cambia es que el mismo documento sale otra vez.
--
-- El contador vive en la tabla solo para que la pantalla pueda decirlo. El rastro real de CADA reenvio,
-- con su motivo, va a clinical_audit_log (evento report.resent), que es el registro inmutable (regla 8).
-- sent_at NO se reescribe: es la fecha del PRIMER envio y es dato clinico.
ALTER TABLE "reports" ADD COLUMN "resent_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "last_resent_at" timestamp with time zone;
