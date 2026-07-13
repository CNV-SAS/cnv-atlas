import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { patients } from "@/db/schema";

import type { PATIENT_DOCUMENT_TYPES } from "../validations";

type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number];

// Resuelve un paciente por documento exacto dentro de una organizacion, para el Nivel c
// (el solicitante indica el documento, no el uuid). Va por owner: el solicitante no
// necesariamente tiene acceso RLS a ese paciente todavia (ese es justo el punto del
// grant). Documento exacto, no difuso: esto es identificacion de un paciente conocido,
// no resolucion de duplicados. Ignora pacientes borrados (deleted_at).
export async function resolvePatientIdByDocument(input: {
  organizationId: string;
  documentType: PatientDocumentType;
  documentNumber: string;
}): Promise<string | null> {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, input.organizationId),
        eq(patients.documentType, input.documentType),
        eq(patients.documentNumber, input.documentNumber),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
