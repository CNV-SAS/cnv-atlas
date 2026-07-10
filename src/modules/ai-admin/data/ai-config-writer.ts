import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura de la config de IA (Drizzle owner, para el audit INLINE, regla 8). La
// autorizacion (admin) se verifica antes en el service/action por policy. ai_config se
// modela como UNA fila mutable: se actualiza la existente o se inserta la primera. La
// historia del cambio queda en clinical_audit_log (ai.config_updated), no en filas nuevas.

export type SaveAiConfigWrite = {
  activeProvider: string;
  activeModel: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function saveAiConfig(input: SaveAiConfigWrite): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: aiConfig.id })
      .from(aiConfig)
      .orderBy(desc(aiConfig.updatedAt))
      .limit(1);

    if (existing) {
      await tx
        .update(aiConfig)
        .set({
          activeProvider: input.activeProvider,
          activeModel: input.activeModel,
          updatedBy: input.actorId,
          updatedAt: new Date(),
        })
        .where(eq(aiConfig.id, existing.id));
    } else {
      await tx.insert(aiConfig).values({
        activeProvider: input.activeProvider,
        activeModel: input.activeModel,
        updatedBy: input.actorId,
      });
    }

    await recordAudit(tx, {
      event: "ai.config_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "ai_config",
      payload: { provider: input.activeProvider, model: input.activeModel },
      ip: input.ip,
    });
  });
}
