-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CORREGIR UNA FECHA DE NACIMIENTO YA REGISTRADA  ·  Santiago, 2026-11-08
--
-- ═══ POR QUE NO EXISTIA, Y POR QUE AHORA SI ═══
--
-- El bloque de la ficha SOLO RELLENA UN HUECO: su `update` lleva en su propia condicion que la fecha
-- este nula. Fue deliberado (2026-10-24) y su razon sigue en pie: *"la fecha de nacimiento decide la
-- RAMA DEL CONSENTIMIENTO (mayor o menor de edad). Pisarla podria convertir un consentimiento firmado
-- como adulto en uno que no autorizaba quien tenia que autorizarlo, y eso no se arregla por detras."*
--
-- Lo que cambio es que ya hay casos REALES: en los grupos 10 y 11 de las mediciones repetidas, la edad
-- de la ficha difiere NUEVE AÑOS de la del equipo. Sin este camino, la unica salida era SQL a mano.
--
-- ═══ UNA TABLA APPEND-ONLY, NO CINCO COLUMNAS EN EL PERFIL ═══
--
-- "El valor anterior se conserva" se puede cumplir de dos formas, y solo una aguanta la segunda
-- correccion: con columnas en `patient_profiles`, corregir dos veces PISA el valor anterior de la
-- primera y la historia se pierde. Con una fila por correccion, la cadena entera queda.
--
-- Y es la misma regla que el resto del registro clinico: nada se reescribe, se escribe encima.
--
-- ═══ EL MOTIVO Y LA FUENTE SON OBLIGATORIOS, Y NO SON LO MISMO ═══
--
--   · el MOTIVO dice por que se corrige ("la edad del equipo no cuadra con la de la ficha");
--   · la FUENTE dice de donde sale el dato nuevo, y es lo que separa una correccion de una suposicion.
--     Una fecha de nacimiento no se corrige de memoria: se corrige contra el documento de identidad.
--
-- `patient_profiles.birth_date` sigue siendo el valor VIGENTE: esta tabla es su historia, no su fuente.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "correcciones_de_fecha_de_nacimiento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  -- NULL = no habia ninguna. No deberia pasar (para eso esta el bloque de completar), pero si alguien
  -- llega por aqui con el hueco, la fila lo dice en vez de fingir que habia una fecha.
  "anterior" date,
  "nueva" date NOT NULL,
  "motivo" text NOT NULL,
  -- DE DONDE SALE EL DATO. Lista cerrada por CHECK y no por enum: todavia puede moverse, y un enum de
  -- Postgres no se puede quitar un valor.
  "fuente" text NOT NULL,
  "corregida_por" uuid NOT NULL REFERENCES "profiles"("id"),
  /**
   * ¿ESTA CORRECCION CAMBIO LA RAMA DEL CONSENTIMIENTO? Se calcula AL CORREGIR y se guarda, no se
   * deriva despues: lo que importa es si en el momento de FIRMAR la persona era mayor o menor con la
   * fecha nueva, y eso depende de la fecha de firma, que no cambia. Guardarlo deja la pregunta
   * contestada en la propia fila, para quien audite dentro de dos años.
   */
  "cambia_la_rama_del_consentimiento" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "correcciones_fecha_nacimiento_motivo_check" CHECK (btrim("motivo") <> ''),
  CONSTRAINT "correcciones_fecha_nacimiento_fuente_check" CHECK (
    "fuente" IN ('documento_de_identidad', 'registro_civil', 'el_paciente_lo_confirmo', 'otro')
  ),
  -- Y NO SE CORRIGE A LO MISMO: una fila que no cambia nada no es una correccion, es ruido en la
  -- historia. El CHECK lo impide aqui, donde no se puede saltar invocando otra cosa.
  CONSTRAINT "correcciones_fecha_nacimiento_cambia_check" CHECK (
    "anterior" IS NULL OR "anterior" <> "nueva"
  )
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "correcciones_fecha_nacimiento_patient_idx"
  ON "correcciones_de_fecha_de_nacimiento" ("patient_id", "created_at");--> statement-breakpoint

COMMENT ON TABLE "correcciones_de_fecha_de_nacimiento" IS
  'La historia de las correcciones de fecha de nacimiento (0244). APPEND-ONLY: patient_profiles.birth_date sigue siendo el valor vigente y esto es su historia. Existe porque la fecha de nacimiento decide la rama del consentimiento y entra al motor por cuatro puertas, asi que cambiarla no puede ser un update silencioso. Y porque una consulta ya diagnosticada con la fecha vieja tiene que poder reemitirse: la pantalla de recalibracion mira estas filas.';--> statement-breakpoint

ALTER TABLE "correcciones_de_fecha_de_nacimiento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SOLO ADMIN, LAS DOS DIRECCIONES. Corregir una fecha de nacimiento cambia la rama del consentimiento y
-- la edad con la que se diagnostico: es del mismo genero que eliminar un perfil o marcar a alguien de
-- prueba, no de los actos de consulta. Y la LECTURA tambien, porque la fila lleva las dos fechas de una
-- persona: para el profesional, el dato vigente es el de la ficha.
CREATE POLICY "correcciones_fecha_nacimiento_admin" ON "correcciones_de_fecha_de_nacimiento"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
