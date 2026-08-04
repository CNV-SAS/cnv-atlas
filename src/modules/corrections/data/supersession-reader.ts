import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Estado de sucesion de una evaluacion: si fue REEMPLAZADA por una correccion y cual es la version
// vigente que la sucede. Sirve para el banner de C2-b (una reemplazada no debe leerse como vigente).
// La relacion old->new vive en clinical_corrections (una sola vez, no por entidad). Va por el cliente
// con sesion (RLS): si la correccion no es del profesional, no hay fila y se reporta no-reemplazada.

export type SupersessionStatus = {
  superseded: boolean;
  newEvaluationId: string | null; // la version vigente que la sucede
};

export async function getSupersessionStatus(evaluationId: string): Promise<SupersessionStatus> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinical_corrections")
    .select("new_evaluation_id")
    .eq("old_evaluation_id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`supersession-reader: ${error.message}`);
  return { superseded: data != null, newEvaluationId: data?.new_evaluation_id ?? null };
}
