import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura de las notas de criterio del profesional de un diagnostico, por RLS (regla dura 3):
// el cliente anon con sesion solo ve los diagnosticos (y sus notas) de los pacientes del
// profesional; si la evaluacion no es suya, no hay filas -> null. Resuelve tambien el
// diagnosisId, que el service usa para escribir (el ownership queda verificado aqui, por RLS).

import type { DiagnosisCriterion } from "./diagnosis-notes-types";

// Los tipos viven en diagnosis-notes-types (modulo neutro) para que el cliente los importe sin el reader.
export type { DiagnosisNote, DiagnosisCriterion } from "./diagnosis-notes-types";

export async function getDiagnosisCriterion(
  evaluationId: string,
): Promise<DiagnosisCriterion | null> {
  const supabase = await createSupabaseServerClient();
  // EL DIAGNOSTICO VIGENTE, que es DONDE SE ESCRIBE una nota nueva. El comentario que habia aqui decia
  // "el pipeline crea un diagnostico por evaluacion", y la reemision por recalibracion volvio falsa esa
  // premisa: ahora hay varios por evaluacion de forma rutinaria.
  const { data: diag, error } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`diagnosis-notes-reader: diagnoses: ${error.message}`);
  if (!diag) return null;

  // PERO SE LEEN LAS DE TODA LA EVALUACION, no las del vigente (2026-10-29). Filtrar por el vigente
  // hacia que al reemitir un diagnostico el criterio escrito por el profesional DESAPARECIERA de la
  // pantalla: sus palabras seguian en la base, colgadas del diagnostico anterior, y la pantalla salia
  // vacia. Es el mismo defecto que escondia el tratamiento, en la otra pestana.
  //
  // Las dos mitades son distintas a proposito: una nota NUEVA pertenece al diagnostico de hoy (por eso
  // `diagnosisId` sigue siendo el vigente), pero las ESCRITAS no se mudan ni se duplican, se siguen
  // viendo. Van en orden cronologico, que es lo que deja leer el criterio como lo que es, un historial.
  const { data: notes, error: nErr } = await supabase
    .from("diagnosis_notes")
    .select("id, note, created_at, diagnoses!inner(evaluation_id)")
    .eq("diagnoses.evaluation_id", evaluationId)
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
