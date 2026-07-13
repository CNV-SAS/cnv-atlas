import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura seudonimizada de las notas narrativas para la auditoria Nivel (b). Todo por
// RLS: las policies de las tres tablas de notas (0019) solo devuelven filas si quien
// consulta es el profesional dueno o tiene un grant notes_pseudonymous activo Y el
// profesional del paciente firmo el Anexo 3 vigente. El filtrado de la precondicion
// pasa dentro de la policy (via helpers security definer), asi que aqui no hace falta
// unir a pacientes: se leen solo la nota, su origen (evaluation/diagnosis/treatment) y
// la fecha. Nunca nombre ni documento del paciente (eso es Nivel c, otra via).
//
// El identificador que se muestra es el de la entidad de origen (un uuid), util para
// agrupar y trazar sin revelar identidad.

export type AuditNote = {
  id: string;
  source: "evaluation" | "diagnosis" | "treatment";
  sourceId: string;
  note: string;
  createdAt: string;
};

const PAGE_SIZE = 50;

export async function getPseudonymousNotes(): Promise<AuditNote[]> {
  const supabase = await createSupabaseServerClient();

  const [evals, diags, treats] = await Promise.all([
    supabase
      .from("evaluation_notes")
      .select("id, evaluation_id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("diagnosis_notes")
      .select("id, diagnosis_id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("treatment_notes")
      .select("id, treatment_id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
  ]);

  const notes: AuditNote[] = [
    ...(evals.data ?? []).map((r) => ({
      id: r.id,
      source: "evaluation" as const,
      sourceId: r.evaluation_id,
      note: r.note,
      createdAt: r.created_at,
    })),
    ...(diags.data ?? []).map((r) => ({
      id: r.id,
      source: "diagnosis" as const,
      sourceId: r.diagnosis_id,
      note: r.note,
      createdAt: r.created_at,
    })),
    ...(treats.data ?? []).map((r) => ({
      id: r.id,
      source: "treatment" as const,
      sourceId: r.treatment_id,
      note: r.note,
      createdAt: r.created_at,
    })),
  ];

  // Orden global por fecha desc (las tres consultas ya vienen ordenadas por su cuenta).
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
