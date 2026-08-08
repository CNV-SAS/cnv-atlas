import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { referrals } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { ReferralTargetValue } from "../validations";

// Escrituras de remisiones (regla 1). Drizzle (server-side) + audit INLINE en la misma transaccion
// (regla 8). La pertenencia (que sea SU paciente) la verifica el reader RLS en la action ANTES de llamar
// aqui; el writer confia en el patientId ya verificado. La inmutabilidad la garantiza el trigger de la BD.

export async function writeCreateReferral(input: {
  treatmentId: string;
  patientId: string;
  organizationId: string;
  referredTo: ReferralTargetValue;
  referredToOther: string | null;
  reason: string;
  referredAt: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(referrals)
      .values({
        organizationId: input.organizationId,
        treatmentId: input.treatmentId,
        patientId: input.patientId,
        referredTo: input.referredTo,
        referredToOther: input.referredToOther,
        reason: input.reason,
        referredAt: input.referredAt,
        createdBy: input.actorId,
      })
      .returning({ id: referrals.id });

    await recordAudit(tx, {
      event: "referral.created",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "referral",
      entityId: row.id,
      payload: {
        treatment_id: input.treatmentId,
        referred_to: input.referredTo,
        ...(input.referredToOther ? { referred_to_other: input.referredToOther } : {}),
      },
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { id: row.id };
  });
}

// "El paciente volvio": segundo acto. El trigger de la BD garantiza write-once (si ya tenia retorno,
// el update lanza y la tx revierte); la action ademas lo chequea antes para dar un mensaje claro.
export async function writeMarkReturn(input: {
  referralId: string;
  returnedAt: string;
  returnNotes: string | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(referrals)
      .set({ returnedAt: input.returnedAt, returnNotes: input.returnNotes })
      .where(eq(referrals.id, input.referralId));

    await recordAudit(tx, {
      event: "referral.returned",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "referral",
      entityId: input.referralId,
      payload: { returned_at: input.returnedAt },
      ip: input.ip,
      userAgent: input.userAgent,
    });
  });
}
