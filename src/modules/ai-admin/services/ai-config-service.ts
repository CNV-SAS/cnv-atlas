import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { saveAiConfig as writeAiConfig } from "../data/ai-config-writer";
import type { SaveAiConfigInput } from "../validations";

// Servicio de la config de IA (la logica vive aqui; el action es thin, regla 2). El
// proveedor elegido DEBE tener su API key en el entorno: activar uno sin key dejaria la IA
// rota. Se valida aqui antes de persistir; las keys viven solo en el entorno, nunca en BD.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

function providerHasKey(provider: string): boolean {
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

export async function saveAiConfig(
  input: SaveAiConfigInput,
  actor: Actor,
): Promise<Result<void>> {
  if (!providerHasKey(input.activeProvider)) {
    return err(
      appError(
        "validation",
        `El proveedor ${input.activeProvider} no tiene API key en el entorno. No se puede activar.`,
      ),
    );
  }
  await writeAiConfig({ ...input, ...actor });
  return ok(undefined);
}
