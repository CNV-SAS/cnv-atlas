import type { DbTransaction } from "@/db";
import { clinicalAuditLog } from "@/db/schema";

// Escribe un evento en clinical_audit_log usando la transaccion que recibe. Asi
// el audit queda INLINE con la mutacion de dominio (regla dura 8): si la
// transaccion se revierte, el audit tambien. Nunca por el bus.
export type AuditInput = {
  event: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  modelVersionId?: string;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(tx: DbTransaction, e: AuditInput): Promise<void> {
  await tx.insert(clinicalAuditLog).values({
    event: e.event,
    actorId: e.actorId,
    actorEmail: e.actorEmail,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    payload: e.payload ?? null,
    modelVersionId: e.modelVersionId ?? null,
    ipAddress: e.ip ?? null,
    userAgent: e.userAgent ?? null,
  });
}
