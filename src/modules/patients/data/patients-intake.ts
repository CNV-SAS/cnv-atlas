import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { CandidateRow } from "../services/identity-resolution";
import type { DocumentType } from "../types";

// Lecturas del intake de la encuesta publica. Van por service role (BYPASSA RLS) a
// proposito: el paciente no tiene sesion (SECURITY.md, superficies publicas; el
// intake del paciente es un caso legitimo de service role). Solo lectura aqui; la
// creacion del paciente la hace el escritor transaccional del intake (sub-tarea 4).

// Limite de candidatos a duplicado que se traen para puntuar en memoria. Acota el
// trabajo aunque la organizacion crezca; el orden final lo da el score.
const CANDIDATE_LIMIT = 50;

// Match exacto por (organizacion, tipo, numero) de documento. Ignora pacientes
// dados de baja (deleted_at). Es la llave de resolucion inicial vs seguimiento.
export async function findPatientByDocument(
  organizationId: string,
  documentType: DocumentType,
  documentNumber: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("document_type", documentType)
    .eq("document_number", documentNumber)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`patients-intake: findPatientByDocument: ${error.message}`);
  }
  return data ? { id: data.id } : null;
}

type ProfileEmbed = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
};

// Posibles duplicados: otros pacientes de la organizacion con quienes el nuevo
// intake podria confundirse. Se acota la busqueda por fecha de nacimiento cuando se
// conoce (filtro selectivo); si no, por apellido. El parecido fino (acentos, typos)
// lo calcula resolveIdentity en memoria sobre este conjunto.
export async function findDuplicateCandidates(
  organizationId: string,
  criteria: { birthDate: string | null; lastName: string },
): Promise<CandidateRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("patients")
    .select(
      "id, document_type, document_number, patient_profiles!inner(first_name, last_name, birth_date)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (criteria.birthDate) {
    query = query.eq("patient_profiles.birth_date", criteria.birthDate);
  } else {
    query = query.ilike("patient_profiles.last_name", criteria.lastName);
  }

  const { data, error } = await query.limit(CANDIDATE_LIMIT);
  if (error) {
    throw new Error(`patients-intake: findDuplicateCandidates: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    // El embed 1:1 puede venir como objeto o como arreglo segun PostgREST; se
    // normaliza a un solo perfil.
    const profile = (
      Array.isArray(row.patient_profiles)
        ? row.patient_profiles[0]
        : row.patient_profiles
    ) as ProfileEmbed | undefined;
    return {
      patientId: row.id,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
      documentType: row.document_type,
      documentNumber: row.document_number,
    };
  });
}
