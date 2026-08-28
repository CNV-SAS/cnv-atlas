import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ConsentType } from "@/modules/consent/validations";
import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

import { NON_COUNTING_EVALUATION_STATUSES } from "../labels";
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
      // superseded_at por evaluacion (no `evaluations(count)`): el conteo debe excluir las
      // reemplazadas por correccion (contarlas infla el numero de consultas del paciente). Se cuentan
      // las vigentes del lado del cliente; el volumen por paciente es chico y va gateado por RLS.
      "id, document_type, document_number, status, patient_profiles!inner(first_name, last_name, birth_date), patient_consents(consent_type, revoked_at), evaluations(superseded_at, status, created_at, bis_measurements(measurement_date))",
    )
    .is("deleted_at", null);
  if (error) {
    throw new Error(`patients-list-reader: listPatientsForProfessional: ${error.message}`);
  }

  const items = (data ?? []).map((row) => {
    const profile = one<ProfileEmbed>(
      row.patient_profiles as ProfileEmbed | ProfileEmbed[] | null,
    );
    // Cuenta solo evaluaciones REALES: vigentes (no supersedidas) y que no sean un shell firmado sin
    // responder ni una abandonada (esas existen pero no son una evaluacion hecha).
    const evals =
      (row.evaluations as
        | {
            superseded_at: string | null;
            status: string;
            created_at: string;
            bis_measurements: { measurement_date: string | null }[] | null;
          }[]
        | null) ?? [];
    // Las que CUENTAN: vigentes y que sean una evaluacion hecha. La misma condicion sirve para el
    // conteo y para la ultima fecha; separarlas dejaria "3 consultas · Ultima: <de una reemplazada>".
    const reales = evals.filter(
      (e) => e.superseded_at == null && !NON_COUNTING_EVALUATION_STATUSES.has(e.status),
    );
    // FECHA DE MEDICION, no la de creacion del registro: es la cronologia clinica, la misma que usa la
    // ficha del paciente. Si no se midio, cae a created_at para no perder la fila del listado.
    const fechas = reales
      .map((e) => e.bis_measurements?.[0]?.measurement_date ?? e.created_at)
      .filter(Boolean)
      .sort();
    // AUTORIZACIONES VIGENTES, para avisar en la LISTA y no al intentar (hallazgo 2026-08-28: hoy el
    // profesional descubre el bloqueo de la regla dura 15 cuando ya esta creando la evaluacion). Se
    // pregunta a la MISMA policy que gatea la creacion, no a una copia del criterio: la regla vive en un
    // solo sitio, asi que la lista y el gate no pueden discrepar.
    const consents =
      (row.patient_consents as { consent_type: string; revoked_at: string | null }[] | null) ?? [];
    const vigentes = consents
      .filter((c) => c.revoked_at === null)
      .map((c) => c.consent_type as ConsentType);
    return {
      patientId: row.id,
      documentType: row.document_type as DocumentType,
      documentNumber: row.document_number,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
      status: row.status,
      evaluationCount: reales.length,
      lastEvaluationDate: fechas.length ? fechas[fechas.length - 1] : null,
      sinAutorizacionVigente: !canCreateEvaluation(vigentes).ok,
    } satisfies PatientListItem;
  });

  // Orden alfabetico por apellido y nombre, para una lista estable y legible.
  items.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"),
  );
  return items;
}
