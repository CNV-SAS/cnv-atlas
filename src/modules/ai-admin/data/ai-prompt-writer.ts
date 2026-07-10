import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiPrompts } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Crea una version NUEVA de un prompt (Drizzle owner, audit INLINE regla 8). La edicion es
// inmutable-por-version: nunca se sobrescribe una version existente. En una transaccion se
// retira la activa (status='retired') y se inserta la nueva como activa, respetando el indice
// unico de "una sola activa por clave". La version nueva = max(version)+1.

export type CreatePromptVersionWrite = {
  promptKey: string;
  content: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function createPromptVersion(input: CreatePromptVersionWrite): Promise<number> {
  return db.transaction(async (tx) => {
    // Ultima version existente (para calcular la siguiente) y la activa (para retirarla).
    const [latest] = await tx
      .select({ version: aiPrompts.version })
      .from(aiPrompts)
      .where(eq(aiPrompts.promptKey, input.promptKey))
      .orderBy(desc(aiPrompts.version))
      .limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;

    // Retira la activa antes de insertar la nueva (el indice parcial exige una sola activa).
    await tx
      .update(aiPrompts)
      .set({ status: "retired" })
      .where(and(eq(aiPrompts.promptKey, input.promptKey), eq(aiPrompts.status, "active")));

    await tx.insert(aiPrompts).values({
      promptKey: input.promptKey,
      version: nextVersion,
      content: input.content,
      status: "active",
      createdBy: input.actorId,
    });

    await recordAudit(tx, {
      event: "ai.prompt_version_created",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "ai_prompt",
      payload: { prompt_key: input.promptKey, version: nextVersion },
      ip: input.ip,
    });

    return nextVersion;
  });
}
