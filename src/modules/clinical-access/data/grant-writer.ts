import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { clinicalAccessGrants } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import type { AppRole } from "@/modules/auth/roles";

import type { AccessGrantType, AccessReasonCategory } from "../grant-rules";

// Escrituras del ciclo de vida de los grants (Drizzle owner, para el audit INLINE, regla
// 8). La autorizacion (policy + canDecideGrant) se verifica antes en el service. Cada
// mutacion emite su evento inmutable en clinical_audit_log dentro de la misma transaccion:
// si algo falla, ni el grant ni el evento quedan.

export type CreateGrantInput = {
  grantType: AccessGrantType;
  reasonCategory: AccessReasonCategory;
  reason: string;
  requesterId: string;
  requesterEmail: string;
  approverRole: AppRole;
  resourceId: string | null;
  ip: string | null;
};

export async function createGrantRequest(input: CreateGrantInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clinicalAccessGrants)
      .values({
        grantType: input.grantType,
        reasonCategory: input.reasonCategory,
        status: "pending",
        requesterId: input.requesterId,
        approverRole: input.approverRole,
        resourceId: input.resourceId,
        reason: input.reason,
      })
      .returning({ id: clinicalAccessGrants.id });

    await recordAudit(tx, {
      event: "access.requested",
      actorId: input.requesterId,
      actorEmail: input.requesterEmail,
      entityType: "clinical_access_grant",
      entityId: row.id,
      payload: {
        grant_type: input.grantType,
        reason_category: input.reasonCategory,
        resource_id: input.resourceId,
        approver_role: input.approverRole,
      },
      ip: input.ip,
    });

    return row.id;
  });
}

export type DecideGrantInput = {
  grantId: string;
  decision: "approve" | "deny";
  approverId: string;
  approverEmail: string;
  expiresAt: Date | null; // solo al aprobar
  ip: string | null;
};

export async function decideGrant(input: DecideGrantInput): Promise<void> {
  const approved = input.decision === "approve";
  await db.transaction(async (tx) => {
    await tx
      .update(clinicalAccessGrants)
      .set({
        status: approved ? "approved" : "denied",
        approverId: input.approverId,
        decidedAt: new Date(),
        expiresAt: approved ? input.expiresAt : null,
        updatedAt: new Date(),
      })
      .where(eq(clinicalAccessGrants.id, input.grantId));

    await recordAudit(tx, {
      event: approved ? "access.approved" : "access.denied",
      actorId: input.approverId,
      actorEmail: input.approverEmail,
      entityType: "clinical_access_grant",
      entityId: input.grantId,
      payload: approved ? { expires_at: input.expiresAt?.toISOString() ?? null } : {},
      ip: input.ip,
    });
  });
}

export type RevokeGrantInput = {
  grantId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function revokeGrant(input: RevokeGrantInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(clinicalAccessGrants)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(clinicalAccessGrants.id, input.grantId));

    await recordAudit(tx, {
      event: "access.revoked",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "clinical_access_grant",
      entityId: input.grantId,
      ip: input.ip,
    });
  });
}
