import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
import type { Profession } from "@/modules/auth/admin-validations";

// Confirmacion del diagnostico (mini-bloque) con audit INLINE (regla 8). Owner db (BYPASSRLS): el
// ownership + la asignacion se verifican ANTES en el service; aqui el diagnosisId ya llega
// autorizado. Guard write-once (confirmed_by IS NULL): si ya estaba confirmado, 0 filas y se lanza,
// para que un doble-submit no genere dos eventos. El trigger de inmutabilidad (mig 0027) lo blinda
// tambien a nivel BD. El evento es diagnosis.confirmed (el ACTO PROPIO); approveReport, cuando
// confirma por su cuenta, usa diagnosis.confirmed_via_report para que el audit distinga las vias.

export class DiagnosisStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagnosisStateError";
  }
}

export type ConfirmDiagnosisWrite = {
  diagnosisId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function confirmDiagnosis(input: ConfirmDiagnosisWrite): Promise<void> {
  // Profesion CON QUE se confirma, para sellarla en el acto (firma clinica). El service ya verifico que
  // el actor es el profesional ASIGNADO, asi que tiene profesion (NOT NULL). null solo si no es profesional.
  const { profession } = await getActorProfession(input.actorId);
  await db.transaction(async (tx) => {
    const confirmed = await tx
      .update(diagnoses)
      .set({
        confirmedBy: input.actorId,
        confirmedAt: sql`now()`,
        confirmedProfession: profession as Profession | null,
      })
      .where(and(eq(diagnoses.id, input.diagnosisId), isNull(diagnoses.confirmedBy)))
      .returning({ id: diagnoses.id });
    if (confirmed.length === 0) {
      throw new DiagnosisStateError("El diagnóstico ya estaba confirmado.");
    }
    await recordAudit(tx, {
      event: "diagnosis.confirmed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: input.diagnosisId,
      payload: {},
      ip: input.ip,
    });
  });
}
