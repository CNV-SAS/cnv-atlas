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
  education_level: string | null;
  occupation: string | null;
  marital_status: string | null;
  socioeconomic_stratum: string | null;
  ethnicity: string | null;
  ancestry: string | null;
};
type ContactEmbed = { email: string | null; phone: string | null };
type EvaluationEmbed = {
  id: string;
  type: EvaluationType;
  status: string;
  created_at: string;
  superseded_at: string | null;
  reason_for_visit: string | null;
  bis_measurements: { measurement_date: string | null }[] | null;
};

// Motivo (arreglo JSON de strings) tolerante: null/ilegible => []. No confia en el contenido de la BD.
function parseReasonForVisit(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// Fecha de medicion de una evaluacion = la mas reciente de sus mediciones (normalmente una); null si
// aun no se midio (draft). La cronologia clinica ordena por esta fecha, no por created_at.
function latestMeasDate(rows: { measurement_date: string | null }[] | null): string | null {
  const dates = (rows ?? []).map((r) => r.measurement_date).filter((d): d is string => d != null);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max), dates[0]);
}

export async function getPatientDetail(patientId: string): Promise<PatientDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, document_type, document_number, status, patient_profiles!inner(first_name, last_name, birth_date, sex, city, country, education_level, occupation, marital_status, socioeconomic_stratum, ethnicity, ancestry), patient_contacts(email, phone), evaluations(id, type, status, created_at, superseded_at, reason_for_visit, bis_measurements(measurement_date))",
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
      measurementDate: latestMeasDate(e.bis_measurements),
      superseded: e.superseded_at != null,
      reasonForVisit: parseReasonForVisit(e.reason_for_visit),
    }))
    // Mas reciente primero, por fecha de MEDICION (cronologia clinica), no por created_at: una
    // corregida tiene created_at de hoy pero se ubica por su medicion original. Fallback a created_at
    // para drafts sin medir. Desempate por created_at para un orden estable.
    .sort((a, b) => {
      const ka = a.measurementDate ?? a.createdAt;
      const kb = b.measurementDate ?? b.createdAt;
      return kb.localeCompare(ka) || b.createdAt.localeCompare(a.createdAt);
    });

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
    educationLevel: profile?.education_level ?? null,
    occupation: profile?.occupation ?? null,
    maritalStatus: profile?.marital_status ?? null,
    socioeconomicStratum: profile?.socioeconomic_stratum ?? null,
    ethnicity: profile?.ethnicity ?? null,
    ancestry: profile?.ancestry ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    evaluations,
  };
}
