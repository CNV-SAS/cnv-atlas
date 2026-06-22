import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura RLS de las evaluaciones listas para generar diagnostico: en estado
// in_progress y CON medicion BIS importada (join inner). La RLS filtra a los pacientes
// del profesional; el embed de diagnoses (permitido por diagnoses_select) dice si ya
// se genero, para mostrar el estado correcto en el panel.

export type DiagnosisCandidate = {
  evaluationId: string;
  patientId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  hasDiagnosis: boolean;
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

export async function listEvaluationsForDiagnosis(): Promise<DiagnosisCandidate[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, type, created_at, patient_id, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)), bis_measurements!inner(id), diagnoses(id)",
    )
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`pipeline-evaluations-reader: listEvaluationsForDiagnosis: ${error.message}`);
  }
  return (data ?? []).map((row) => {
    const patient = one<PatientEmbed>(row.patients as PatientEmbed | PatientEmbed[] | null);
    const profile = one(patient?.patient_profiles ?? null);
    const diagnoses = (row.diagnoses as { id: string }[] | null) ?? [];
    return {
      evaluationId: row.id,
      patientId: row.patient_id,
      type: row.type,
      createdAt: row.created_at,
      documentType: patient?.document_type ?? "",
      documentNumber: patient?.document_number ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      hasDiagnosis: diagnoses.length > 0,
    };
  });
}
