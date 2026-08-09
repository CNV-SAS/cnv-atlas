import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
// Motores medico y ejercicio congelados (D-008). DISPLAY-ONLY: se corren al vuelo para la vista del
// profesional, no se sella nada, no entra al pipeline. Salida PROFESIONAL-FACING (nada al paciente).
// El que CORRE es el .authorized (original + modificaciones autorizadas). El original queda intacto
// como referencia byte-identica a Gildardo.
import { motorTratEjercicio, motorTratMedico } from "@/clinical-engine/frozen/atlas-tratamiento.authorized.js";
import { normalizeHeader } from "@/modules/bis/services/header-map";

export type MedicoTreatment = {
  metas: string[];
  monitoreo: string[];
  remision: string[];
  medNotas: string[];
};
export type EjercicioTreatment = {
  clearance: string;
  fitt: { frecuencia: string; intensidad: string; tiempo: string; tipo: string; volumen: string; progresion: string };
  enfasis: string[];
  faRec: string;
};
export type MedicoEjercicioTreatment = {
  medico: MedicoTreatment;
  ejercicio: EjercicioTreatment;
  // ASMI (masa apendicular) sellada en el snapshot? Si no (diagnostico viejo, emitido antes de sellarla),
  // los motores corren pero el criterio de sarcopenia por masa apendicular NO se evaluo: se avisa.
  asmiAvailable: boolean;
  // La medicacion (d5_40) se capturo? Hoy false siempre: d5_40 no tiene field_key (port pendiente, ver
  // BACKLOG). Sin ella, el motor medico no evalua interacciones farmaco-nutriente: se dice, no se calla.
  medsCaptured: boolean;
};

const PESO_VAR = normalizeHeader("Peso kg");
const TALLA_VAR = normalizeHeader("Altura cm");

function edadFrom(birthDate: string | null): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age < 0 ? 0 : age;
}

// Reconstruye enc (encuesta por field_key) + bis (talla/peso de la medicion, sexo/edad del paciente,
// FMI/FFMI/ASMI del snapshot del diagnostico) y corre los motores medico y ejercicio. null si no hay
// medicion o snapshot. Todo por RLS (regla 3).
export async function getMedicoEjercicioForEvaluation(
  evaluationId: string,
): Promise<MedicoEjercicioTreatment | null> {
  const supabase = await createSupabaseServerClient();

  const [{ data: ev }, { data: report }, { data: meas }] = await Promise.all([
    supabase.from("evaluations").select("patient_id").eq("id", evaluationId).maybeSingle(),
    supabase
      .from("reports")
      .select("snapshot")
      .eq("evaluation_id", evaluationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bis_measurements")
      .select("id")
      .eq("evaluation_id", evaluationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!ev || !report?.snapshot || !meas) return null;

  const snap = report.snapshot as {
    indicators?: { FMI?: number; FFMI?: number };
    asmi?: number | null;
  };
  const FMI = snap.indicators?.FMI ?? 0;
  const FFMI = snap.indicators?.FFMI ?? 0;
  const ASMI = typeof snap.asmi === "number" ? snap.asmi : 0;
  const asmiAvailable = typeof snap.asmi === "number";

  const [{ data: profile }, { data: rawRows }, { data: response }] = await Promise.all([
    supabase.from("patient_profiles").select("sex, birth_date").eq("patient_id", ev.patient_id).maybeSingle(),
    supabase
      .from("bis_raw_values")
      .select("variable_name, value")
      .eq("measurement_id", meas.id)
      .in("variable_name", [PESO_VAR, TALLA_VAR]),
    supabase
      .from("survey_responses")
      .select("id")
      .eq("evaluation_id", evaluationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sexo = (profile?.sex ?? "").toLowerCase().startsWith("f") ? "F" : "M";
  const raw: Record<string, number> = {};
  for (const r of rawRows ?? []) raw[r.variable_name] = Number(r.value);
  const bis = {
    talla: raw[TALLA_VAR] ?? 0,
    peso: raw[PESO_VAR] ?? 0,
    sexo,
    FMI,
    FFMI,
    ASMI,
  };

  // enc por field_key (solo lo que leen estos motores; multi-select a array).
  const enc: Record<string, unknown> = { edad: edadFrom(profile?.birth_date ?? null) };
  if (response) {
    const { data: answers } = await supabase
      .from("survey_answers")
      .select("answer_value, survey_questions!inner(field_key, question_type)")
      .eq("response_id", response.id);
    for (const a of answers ?? []) {
      const q = a.survey_questions as unknown as { field_key: string | null; question_type: string } | null;
      if (!q?.field_key) continue;
      if (q.question_type === "opcion_multiple") {
        try {
          const parsed: unknown = JSON.parse(a.answer_value ?? "");
          enc[q.field_key] = Array.isArray(parsed) ? parsed : a.answer_value ?? "";
        } catch {
          enc[q.field_key] = a.answer_value ?? "";
        }
      } else {
        enc[q.field_key] = a.answer_value ?? "";
      }
    }
  }

  return {
    medico: motorTratMedico(enc, bis) as MedicoTreatment,
    ejercicio: motorTratEjercicio(enc, bis) as EjercicioTreatment,
    asmiAvailable,
    medsCaptured: "d5_40" in enc,
  };
}
