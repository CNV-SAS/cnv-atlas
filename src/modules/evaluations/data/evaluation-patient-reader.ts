import "server-only";

import { normalizeSexo } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Resuelve si el paciente de la evaluacion es hombre, por el MISMO camino normalizado que el motor
// (normalizeSexo canonico). patient_profiles.sex es CRUDO (el intake captura texto libre; el Biody
// exporta "Male"); comparar el string crudo cambiaria el corte antropometrico. Solo alimenta el
// chip de cintura de la composicion (referencia OMS). Si el sexo falta o es desconocido, cae a
// hombre (fallback de display; caso raro, solo afecta ese chip) en vez de tronar la vista. Va por
// el cliente con sesion (RLS de evaluations / patient_profiles gatea por el profesional del paciente).
export async function getEvaluationPatientIsMale(evaluationId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data: ev, error: eErr } = await supabase
    .from("evaluations")
    .select("patient_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`evaluation-patient-reader: evaluations: ${eErr.message}`);
  if (!ev) return true;

  const { data: prof, error: pErr } = await supabase
    .from("patient_profiles")
    .select("sex")
    .eq("patient_id", ev.patient_id)
    .maybeSingle();
  if (pErr) throw new Error(`evaluation-patient-reader: patient_profiles: ${pErr.message}`);

  try {
    return normalizeSexo(prof?.sex) === "M";
  } catch {
    return true;
  }
}
