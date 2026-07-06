import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { evaluations, patientConsents, patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { checkConsentBranchConsistency } from "../services/consent-branch-check";

// Escritura de la confirmacion de identidad. Drizzle (owner) para poder dejar el
// audit INLINE en la misma transaccion (regla dura 8). La autorizacion (que el
// profesional sea de ese paciente) se verifica antes, en el action, leyendo la
// evaluacion bajo RLS.

// Discrepancia entre la fecha de nacimiento real y la rama de consentimiento usada
// (DELTA2 B3). El action la mapea a un mensaje para el profesional; la confirmacion no
// procede hasta resolverla (rehacer el consentimiento con la rama correcta).
export class ConsentBranchMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentBranchMismatchError";
  }
}

export type ConfirmIdentityInput = {
  evaluationId: string;
  patientId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Pasa la evaluacion de draft a in_progress y audita evaluation.identity_confirmed.
// El guard status='draft' hace la operacion idempotente: una segunda confirmacion no
// vuelve a auditar.
export async function confirmEvaluationIdentity(
  input: ConfirmIdentityInput,
): Promise<{ confirmed: boolean }> {
  return db.transaction(async (tx) => {
    // Segundo muro (DELTA2 B3): la rama de consentimiento usada debe ser consistente
    // con la fecha de nacimiento real. Se lee dentro de la transaccion para una vista
    // consistente. La rama menor se detecta por un consentimiento representante_legal
    // vigente.
    const [profile] = await tx
      .select({ birthDate: patientProfiles.birthDate })
      .from(patientProfiles)
      .where(eq(patientProfiles.patientId, input.patientId));
    const rep = await tx
      .select({ id: patientConsents.id })
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientId, input.patientId),
          eq(patientConsents.consentType, "representante_legal"),
          isNull(patientConsents.revokedAt),
        ),
      )
      .limit(1);
    const check = checkConsentBranchConsistency({
      birthDate: profile?.birthDate ?? null,
      usedMinorBranch: rep.length > 0,
      now: new Date(),
    });
    if (!check.ok) throw new ConsentBranchMismatchError(check.message);

    const updated = await tx
      .update(evaluations)
      .set({ status: "in_progress" })
      .where(
        and(eq(evaluations.id, input.evaluationId), eq(evaluations.status, "draft")),
      )
      .returning({ id: evaluations.id });
    if (updated.length === 0) return { confirmed: false };

    await recordAudit(tx, {
      event: "evaluation.identity_confirmed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: { patient_id: input.patientId },
      ip: input.ip,
    });
    return { confirmed: true };
  });
}
