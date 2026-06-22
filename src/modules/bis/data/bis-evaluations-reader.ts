import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura RLS de evaluaciones listas para importar BIS: en estado in_progress (la
// identidad ya fue confirmada en B7). La RLS filtra a los pacientes del profesional
// (evaluations_select) y deja ver sus mediciones (bis_measurements_select), con lo que
// sabemos si ya hay una medicion importada sin exponer datos de otros profesionales.

export type BisImportEvaluation = {
  evaluationId: string;
  patientId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  alreadyImported: boolean;
};

type PatientEmbed = {
  document_type: string;
  document_number: string;
  patient_profiles:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
};

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

export async function listEvaluationsForBisImport(): Promise<BisImportEvaluation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, type, created_at, patient_id, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)), bis_measurements(id)",
    )
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`bis-evaluations-reader: listEvaluationsForBisImport: ${error.message}`);
  }
  return (data ?? []).map((row) => {
    const patient = one<PatientEmbed>(row.patients as PatientEmbed | PatientEmbed[] | null);
    const profile = one(patient?.patient_profiles ?? null);
    const measurements = (row.bis_measurements as { id: string }[] | null) ?? [];
    return {
      evaluationId: row.id,
      patientId: row.patient_id,
      type: row.type,
      createdAt: row.created_at,
      documentType: patient?.document_type ?? "",
      documentNumber: patient?.document_number ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      alreadyImported: measurements.length > 0,
    };
  });
}
