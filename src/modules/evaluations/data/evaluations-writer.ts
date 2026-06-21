import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura de la confirmacion de identidad. Drizzle (owner) para poder dejar el
// audit INLINE en la misma transaccion (regla dura 8). La autorizacion (que el
// profesional sea de ese paciente) se verifica antes, en el action, leyendo la
// evaluacion bajo RLS.

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
