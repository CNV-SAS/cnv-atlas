import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura para confirmar el diagnostico, por RLS (regla 3): si la evaluacion no es del profesional,
// no hay filas -> null. Trae el professional_id de la evaluacion para el chequeo EXPLICITO de
// asignacion (defensa en profundidad, no solo RLS) y si ya esta confirmado (para no re-confirmar).
export type DiagnosisForConfirmation = {
  diagnosisId: string;
  evaluationProfessionalId: string;
  alreadyConfirmed: boolean;
};

export async function getDiagnosisForConfirmation(
  evaluationId: string,
): Promise<DiagnosisForConfirmation | null> {
  const supabase = await createSupabaseServerClient();

  const { data: ev, error: eErr } = await supabase
    .from("evaluations")
    .select("professional_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`diagnosis-confirm-reader: evaluations: ${eErr.message}`);
  if (!ev) return null;

  const { data: d, error: dErr } = await supabase
    .from("diagnoses")
    .select("id, confirmed_by")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`diagnosis-confirm-reader: diagnoses: ${dErr.message}`);
  if (!d) return null;

  return {
    diagnosisId: d.id,
    evaluationProfessionalId: ev.professional_id,
    alreadyConfirmed: d.confirmed_by != null,
  };
}
