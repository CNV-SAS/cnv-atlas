import "server-only";

import { db } from "@/db";
import { aiMenuSuggestions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Persistencia de una sugerencia de menu por IA (B13). ai_menu_suggestions es INMUTABLE
// (sin UPDATE/DELETE por RLS): cada intento, exitoso o fallido, deja su fila con
// procedencia (proveedor/modelo/version de prompt/latencia/estado). El diagnostico NO es
// IA; esto es solo apoyo, un borrador que el profesional revisa (nunca se auto-aplica).
// Audit inline (regla 8). La autorizacion (ownership) se verifico antes bajo RLS en el
// service; aqui el treatmentId ya llega autorizado.

export type MenuSuggestionStatus = "success" | "timeout" | "parse_failed" | "provider_error";

export type RecordMenuInput = {
  treatmentId: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedText: string | null;
  rawResponse: unknown;
  status: MenuSuggestionStatus;
  latencyMs: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function recordMenuSuggestion(input: RecordMenuInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(aiMenuSuggestions)
      .values({
        treatmentId: input.treatmentId,
        generatedBy: input.actorId,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        generatedText: input.generatedText,
        rawResponse: input.rawResponse ?? null,
        status: input.status,
        latencyMs: input.latencyMs,
      })
      .returning({ id: aiMenuSuggestions.id });

    await recordAudit(tx, {
      event: "ai_menu.generated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "ai_menu_suggestion",
      entityId: row.id,
      payload: {
        treatment_id: input.treatmentId,
        provider: input.provider,
        model: input.model,
        prompt_version: input.promptVersion,
        status: input.status,
        latency_ms: input.latencyMs,
      },
      ip: input.ip,
    });

    return { id: row.id };
  });
}
