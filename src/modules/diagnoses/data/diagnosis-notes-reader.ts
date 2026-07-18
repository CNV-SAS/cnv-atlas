import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura de las notas de criterio del profesional de un diagnostico, por RLS (regla dura 3):
// el cliente anon con sesion solo ve los diagnosticos (y sus notas) de los pacientes del
// profesional; si la evaluacion no es suya, no hay filas -> null. Resuelve tambien el
// diagnosisId, que el service usa para escribir (el ownership queda verificado aqui, por RLS).

export type DiagnosisNote = { id: string; note: string; createdAt: string };
export type DiagnosisCriterion = { diagnosisId: string; notes: DiagnosisNote[] };

export async function getDiagnosisCriterion(
  evaluationId: string,
): Promise<DiagnosisCriterion | null> {
  const supabase = await createSupabaseServerClient();
  // El pipeline crea un diagnostico por evaluacion; si hubiera mas de uno, el mas reciente.
  const { data: diag, error } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`diagnosis-notes-reader: diagnoses: ${error.message}`);
  if (!diag) return null;

  const { data: notes, error: nErr } = await supabase
    .from("diagnosis_notes")
    .select("id, note, created_at")
    .eq("diagnosis_id", diag.id)
    .order("created_at", { ascending: true });
  if (nErr) throw new Error(`diagnosis-notes-reader: notes: ${nErr.message}`);

  return {
    diagnosisId: diag.id as string,
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      note: n.note as string,
      createdAt: n.created_at as string,
    })),
  };
}
