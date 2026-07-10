import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiPrompts } from "@/db/schema";

// Lee la version ACTIVA de un prompt versionado para el flujo del motor (generate-menu).
// Via Drizzle owner: el flujo del profesional necesita el prompt sin ser admin (la RLS de
// ai_prompts es admin-only y aplica al cliente anon, no al owner). Es contenido de prompt,
// no PII. Si no hay fila activa (BD sin sembrar), devuelve null y el llamador cae al texto
// canonico en codigo.

export async function getActivePrompt(
  promptKey: string,
): Promise<{ version: number; content: string } | null> {
  const [row] = await db
    .select({ version: aiPrompts.version, content: aiPrompts.content })
    .from(aiPrompts)
    .where(and(eq(aiPrompts.promptKey, promptKey), eq(aiPrompts.status, "active")))
    .limit(1);
  return row ?? null;
}
