import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lecturas RLS de evaluaciones para el panel del profesional. La RLS hace el filtro:
// evaluations_select deja al profesional ver las de sus pacientes y a admin todas.

export type PendingIdentityEvaluation = {
  evaluationId: string;
  patientId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
};

type PatientEmbed = {
  document_type: string;
  document_number: string;
  patient_profiles:
    | { first_name: string; last_name: string; birth_date: string | null }
    | { first_name: string; last_name: string; birth_date: string | null }[]
    | null;
};

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// Evaluaciones en estado draft (recien llegadas de la encuesta, pendientes de que el
// profesional confirme la identidad del paciente).
export async function listPendingIdentityChecks(): Promise<PendingIdentityEvaluation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, type, created_at, patient_id, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name, birth_date))",
    )
    .eq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`evaluations-repository: listPendingIdentityChecks: ${error.message}`);
  }
  return (data ?? []).map((row) => {
    const patient = one<PatientEmbed>(row.patients as PatientEmbed | PatientEmbed[] | null);
    const profile = one(patient?.patient_profiles ?? null);
    return {
      evaluationId: row.id,
      patientId: row.patient_id,
      type: row.type,
      createdAt: row.created_at,
      documentType: patient?.document_type ?? "",
      documentNumber: patient?.document_number ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
    };
  });
}

// Comprueba acceso a una evaluacion bajo RLS y devuelve su paciente y estado. Si la
// sesion no puede leerla (no es su paciente), devuelve null: sirve de gate de
// ownership antes de la escritura por owner.
export async function getEvaluationOwnership(
  evaluationId: string,
): Promise<{ patientId: string; status: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("patient_id, status")
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`evaluations-repository: getEvaluationOwnership: ${error.message}`);
  return data ? { patientId: data.patient_id, status: data.status } : null;
}

// Cuasi-identificadores estables del paciente para pre-llenar un link de seguimiento.
// RLS: devuelve null si el paciente no es del profesional (no lo puede leer).
export async function getPatientPrefill(
  patientId: string,
): Promise<{ city: string | null; phone: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile, error: pErr }, { data: contact, error: cErr }] = await Promise.all([
    supabase.from("patient_profiles").select("city").eq("patient_id", patientId).maybeSingle(),
    supabase.from("patient_contacts").select("phone").eq("patient_id", patientId).maybeSingle(),
  ]);
  if (pErr) throw new Error(`evaluations-repository: getPatientPrefill: ${pErr.message}`);
  if (cErr) throw new Error(`evaluations-repository: getPatientPrefill: ${cErr.message}`);
  if (!profile) return null; // sin acceso (RLS) o no existe
  return { city: profile.city ?? null, phone: contact?.phone ?? null };
}
