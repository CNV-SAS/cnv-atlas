-- RLS de patient_contraindications.
--
-- POR QUE VA EN SU PROPIA MIGRACION: Drizzle crea la tabla pero NO enciende RLS ni escribe politicas.
-- Verificado tras aplicar la 0081: `relrowsecurity = false`. Una tabla de datos clinicos del paciente sin
-- RLS es legible por cualquier sesion con la anon key, que es exactamente lo que la regla dura 1 impide.
--
-- EL GATE ES EL MISMO QUE EL DE SU HISTORIA: `is_patient_professional(patient_id)`, la funcion que ya usan
-- treatment_notes, bis_conditions y el resto. No se inventa un criterio propio: una contraindicacion es
-- dato clinico del paciente y se ve si y solo si el paciente es tuyo.
--
-- NO se agrega la via de grant seudonimizado (`has_active_grant`) que treatment_notes si tiene para las
-- notas: esa se decide en el bloque de gobernanza de accesos, con su tipo de grant propio, no aqui de
-- pasada. Sin ella, el acceso queda MAS restringido, que es el lado correcto para empezar.
ALTER TABLE "patient_contraindications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "patient_contraindications_select" ON "patient_contraindications"
  FOR SELECT TO authenticated
  USING (is_patient_professional(patient_id));
--> statement-breakpoint
CREATE POLICY "patient_contraindications_insert" ON "patient_contraindications"
  FOR INSERT TO authenticated
  WITH CHECK (is_patient_professional(patient_id));
