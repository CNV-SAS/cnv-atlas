import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Contenido de REFERENCIA de los 81 estados EFR para explorar la Diana. Es autoritativo (validado
// con Gildardo al poblar el registry en B11), pero NO es el diagnostico del paciente: ese vive en
// el snapshot inmutable (efrContent) y jamas se lee del registry, ni durante la exploracion. Se lee
// por el model_version_id del diagnostico del paciente para que la pantalla sea era-consistente (el
// paciente y los estados que explora pertenecen al mismo modelo). RLS efr_states_select gatea la
// lectura. Solo display.

export type EfrStateRef = {
  stateNumber: number;
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

export async function getEfrStatesForModel(
  modelVersionId: string,
): Promise<Record<number, EfrStateRef>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("efr_states")
    .select("state_number, diagnosis_name, mechanism, biomarkers, risks, suggested_nutraceuticals")
    .eq("model_version_id", modelVersionId);
  if (error) throw new Error(`efr-states-reader: ${error.message}`);

  const map: Record<number, EfrStateRef> = {};
  for (const r of data ?? []) {
    map[r.state_number] = {
      stateNumber: r.state_number,
      diagnosisName: r.diagnosis_name,
      mechanism: r.mechanism,
      biomarkers: r.biomarkers,
      risks: r.risks,
      suggestedNutraceuticals: r.suggested_nutraceuticals,
    };
  }
  return map;
}
