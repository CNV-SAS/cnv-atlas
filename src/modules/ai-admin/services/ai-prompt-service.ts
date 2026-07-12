import "server-only";

import { ok, type Result } from "@/core/errors/result";
import { getActivePrompt } from "@/lib/ai/prompts";

import { createPromptVersion as writePromptVersion } from "../data/ai-prompt-writer";
import type { SavePromptInput } from "../validations";

// Servicio de prompts versionados (la logica vive aqui; el action es thin, regla 2). Cada
// guardado crea una version nueva auditada; no se edita en sitio (inmutable por version).
// Guarda de no-op: si el texto es identico al de la version activa, NO se crea version nueva
// ni se audita (evita versiones duplicadas y ruido en el audit); el action lo reporta como
// "sin cambios que guardar".

type Actor = { actorId: string; actorEmail: string; ip: string | null };

export async function createPromptVersion(
  input: SavePromptInput,
  actor: Actor,
): Promise<Result<{ version: number | null; unchanged: boolean }>> {
  const active = await getActivePrompt(input.promptKey);
  if (active && active.content.trim() === input.content.trim()) {
    return ok({ version: null, unchanged: true });
  }
  const version = await writePromptVersion({ ...input, ...actor });
  return ok({ version, unchanged: false });
}
