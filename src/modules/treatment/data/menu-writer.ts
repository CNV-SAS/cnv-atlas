import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { aiMenuSuggestions, menuAllergenDismissals } from "@/db/schema";
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
  // v3. menuJson: el menu parseado (NULL en v2 y en fallos). alergenosDetectados: los hallazgos del
  // cruce; [] = revisado y limpio, NULL = NO se pudo revisar. Los dos estados se leen distinto.
  menuJson?: unknown;
  alergenosDetectados?: unknown;
  patronConflictos?: unknown;
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
        menuJson: input.menuJson ?? null,
        alergenosDetectados: input.alergenosDetectados ?? null,
        patronConflictos: input.patronConflictos ?? null,
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

/**
 * Descarta el aviso de alergeno de UNA sugerencia concreta, con motivo obligatorio.
 *
 * NO TOCA LA SUGERENCIA, y eso es deliberado, no una limitacion: `ai_menu_suggestions` es inmutable
 * (RLS sin UPDATE/DELETE), asi que el aviso no se puede borrar ni queriendo. Descartar es decir "lo mire
 * y esta bien", no "no paso nada": quien vuelva a abrir esa sugerencia sigue viendo el alergeno detectado
 * Y, al lado, quien lo descarto y por que.
 *
 * El evento va INLINE en la transaccion (regla dura 8), nunca por el bus.
 */
export async function dismissMenuAllergenAlert(input: {
  suggestionId: string;
  reason: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    // ESTADO (lo que la pantalla lee) y TRAZA (el evento), en la MISMA transaccion para que no puedan
    // divergir. El audit log solo no bastaba: es admin-only para SELECT, asi que el profesional escribia
    // su descarte y no lo veia nunca (defecto cazado en el smoke, ver 0088).
    await tx
      .insert(menuAllergenDismissals)
      .values({
        suggestionId: input.suggestionId,
        dismissedBy: input.actorId,
        dismissedByEmail: input.actorEmail,
        reason: input.reason,
      })
      .onConflictDoUpdate({
        target: menuAllergenDismissals.suggestionId,
        // Descartar dos veces el mismo aviso es la MISMA decision, no historia nueva: gana el ultimo.
        // La historia completa de intentos queda en el audit log, que es donde va la traza.
        set: {
          dismissedBy: input.actorId,
          dismissedByEmail: input.actorEmail,
          reason: input.reason,
          dismissedAt: sql`now()`,
        },
      });
    await recordAudit(tx, {
      event: "menu.allergen_alert_dismissed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "ai_menu_suggestion",
      entityId: input.suggestionId,
      // El MOTIVO es el dato: alguien decidio que un menu con un alergeno detectado se podia usar.
      payload: { reason: input.reason },
      ip: input.ip,
    });
  });
}
