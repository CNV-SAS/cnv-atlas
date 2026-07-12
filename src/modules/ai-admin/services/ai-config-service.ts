import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { saveAiConfig as writeAiConfig } from "../data/ai-config-writer";
import { modelsForProvider } from "../models";
import type { SaveAiConfigInput } from "../validations";

// Servicio de la config de IA (la logica vive aqui; el action es thin, regla 2). El cliente
// solo elige el PROVEEDOR; el servidor DERIVA el modelo del entorno para ese proveedor. Asi
// no puede llegar un par proveedor/modelo inconsistente desde el cliente (elimina la ventana
// de carrera del submit rapido, no la sincroniza). Guardas: (1) el proveedor DEBE tener API
// key en el entorno; (2) DEBE existir un modelo configurado en el entorno para el. Las keys y
// el modelo viven solo en el entorno, nunca llegan del cliente ni se guardan sueltos en BD.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

function providerHasKey(provider: string): boolean {
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

export async function saveAiConfig(
  input: SaveAiConfigInput,
  actor: Actor,
): Promise<Result<{ provider: string; model: string }>> {
  if (!providerHasKey(input.activeProvider)) {
    return err(
      appError(
        "validation",
        `El proveedor ${input.activeProvider} no tiene API key en el entorno. No se puede activar.`,
      ),
    );
  }
  // Modelo derivado del entorno para el proveedor recibido. No llega del cliente.
  const model = modelsForProvider(input.activeProvider)[0];
  if (!model) {
    return err(
      appError(
        "validation",
        `No hay modelo configurado en el entorno para ${input.activeProvider}.`,
      ),
    );
  }
  await writeAiConfig({ activeProvider: input.activeProvider, activeModel: model, ...actor });
  return ok({ provider: input.activeProvider, model });
}
