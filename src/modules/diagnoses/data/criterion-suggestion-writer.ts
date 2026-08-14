import "server-only";

import { db } from "@/db";
import { aiCriterionSuggestions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Persistencia de una generacion de borrador de criterio por IA. ai_criterion_suggestions es INMUTABLE
// (sin UPDATE/DELETE por RLS): cada intento, exitoso o fallido, deja su fila con procedencia
// (proveedor/modelo/version de prompt/latencia/estado). "Todo lo que la IA produce deja rastro": si algun
// dia se cuestiona un criterio, importa saber si venia generado. El diagnostico NO es IA; esto es apoyo,
// un borrador que el profesional revisa (nunca se auto-aplica). Audit inline (regla 8). El ownership se
// verifico antes bajo RLS en el service; aqui el diagnosisId ya llega autorizado.

export type CriterionSuggestionStatus = "success" | "timeout" | "provider_error";

export type RecordCriterionInput = {
  diagnosisId: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedText: string | null;
  rawResponse: unknown;
  status: CriterionSuggestionStatus;
  latencyMs: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function recordCriterionSuggestion(input: RecordCriterionInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(aiCriterionSuggestions)
      .values({
        diagnosisId: input.diagnosisId,
        generatedBy: input.actorId,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        generatedText: input.generatedText,
        rawResponse: input.rawResponse ?? null,
        status: input.status,
        latencyMs: input.latencyMs,
      })
      .returning({ id: aiCriterionSuggestions.id });

    await recordAudit(tx, {
      event: "ai_criterion.generated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "ai_criterion_suggestion",
      entityId: row.id,
      payload: {
        diagnosis_id: input.diagnosisId,
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
