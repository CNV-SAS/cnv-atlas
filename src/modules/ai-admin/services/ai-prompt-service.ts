import "server-only";

import { ok, type Result } from "@/core/errors/result";

import { createPromptVersion as writePromptVersion } from "../data/ai-prompt-writer";
import type { SavePromptInput } from "../validations";

// Servicio de prompts versionados (la logica vive aqui; el action es thin, regla 2). Cada
// guardado crea una version nueva auditada; no se edita en sitio (inmutable por version).

type Actor = { actorId: string; actorEmail: string; ip: string | null };

export async function createPromptVersion(
  input: SavePromptInput,
  actor: Actor,
): Promise<Result<{ version: number }>> {
  const version = await writePromptVersion({ ...input, ...actor });
  return ok({ version });
}
