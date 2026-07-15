import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DocumentType, PatientListItem } from "../types";

// Roster de pacientes para la UI autenticada (regla 1). Cliente anon + RLS:
// patients_select / patient_profiles_select dejan al profesional ver solo los suyos
// (via is_patient_professional) y a admin todos. La app no filtra por profesional, lo
// hace RLS (regla 3). El conteo de evaluaciones va por embed, tambien gateado por RLS.

type ProfileEmbed = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
};

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

export async function listPatientsForProfessional(): Promise<PatientListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, document_type, document_number, status, patient_profiles!inner(first_name, last_name, birth_date), evaluations(count)",
    )
    .is("deleted_at", null);
  if (error) {
    throw new Error(`patients-list-reader: listPatientsForProfessional: ${error.message}`);
  }

  const items = (data ?? []).map((row) => {
    const profile = one<ProfileEmbed>(
      row.patient_profiles as ProfileEmbed | ProfileEmbed[] | null,
    );
    const countRow = one<{ count: number }>(
      row.evaluations as { count: number }[] | null,
    );
    return {
      patientId: row.id,
      documentType: row.document_type as DocumentType,
      documentNumber: row.document_number,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
      status: row.status,
      evaluationCount: countRow?.count ?? 0,
    } satisfies PatientListItem;
  });

  // Orden alfabetico por apellido y nombre, para una lista estable y legible.
  items.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"),
  );
  return items;
}
