import "server-only";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// Registra el "uso efectivo" de un grant (el tercer evento del ciclo, tras
// access.requested y access.approved). Va por owner con audit inline (regla dura 8):
// RLS concede filas pero no puede loguear un SELECT, asi que el uso solo se captura
// mediando el servidor. Se llama al abrir la pantalla de auditoria (Nivel b) y en la
// accion identificada (Nivel c). No muta dominio; solo escribe el evento inmutable.

export type AccessUsedInput = {
  grantId: string;
  grantType: "notes_pseudonymous" | "notes_identified";
  actorId: string;
  actorEmail: string;
  resourceId?: string | null;
  ip?: string | null;
};

export async function recordAccessUsed(input: AccessUsedInput): Promise<void> {
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      event: "access.used",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "clinical_access_grant",
      entityId: input.grantId,
      payload: {
        grant_type: input.grantType,
        resource_id: input.resourceId ?? null,
      },
      ip: input.ip,
    });
  });
}
