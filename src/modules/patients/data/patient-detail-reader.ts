import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DocumentType, EvaluationType, PatientDetail } from "../types";

// Detalle de un paciente para su historia (regla 1). Cliente anon + RLS: patients,
// patient_profiles, patient_contacts y evaluations solo son visibles para el profesional
// dueno (via is_patient_professional) y admin. Si la sesion no lo posee, la fila no llega
// y se devuelve null (gate de ownership antes de renderizar).

type ProfileEmbed = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  sex: string | null;
  city: string | null;
  country: string | null;
};
type ContactEmbed = { email: string | null; phone: string | null };
type EvaluationEmbed = { id: string; type: EvaluationType; status: string; created_at: string };

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

export async function getPatientDetail(patientId: string): Promise<PatientDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, document_type, document_number, status, patient_profiles!inner(first_name, last_name, birth_date, sex, city, country), patient_contacts(email, phone), evaluations(id, type, status, created_at)",
    )
    .eq("id", patientId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`patient-detail-reader: getPatientDetail: ${error.message}`);
  }
  if (!data) return null;

  const profile = one<ProfileEmbed>(
    data.patient_profiles as ProfileEmbed | ProfileEmbed[] | null,
  );
  const contact = one<ContactEmbed>(
    data.patient_contacts as ContactEmbed | ContactEmbed[] | null,
  );
  const evaluations = ((data.evaluations as EvaluationEmbed[] | null) ?? [])
    .map((e) => ({
      evaluationId: e.id,
      type: e.type,
      status: e.status,
      createdAt: e.created_at,
    }))
    // Mas reciente primero: la linea de tiempo se lee de arriba (hoy) hacia abajo.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    patientId: data.id,
    documentType: data.document_type as DocumentType,
    documentNumber: data.document_number,
    status: data.status,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    birthDate: profile?.birth_date ?? null,
    sex: profile?.sex ?? null,
    city: profile?.city ?? null,
    country: profile?.country ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    evaluations,
  };
}
