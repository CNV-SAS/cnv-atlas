import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { isEngineOutput } from "@/clinical-engine";
import { resolveAiConfig } from "@/lib/ai/config";
import { getActivePrompt } from "@/lib/ai/prompts";
import { AiError, generateText } from "@/lib/ai/provider";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";

import { getTreatmentProtocol } from "../data/treatment-reader";
import { recordMenuSuggestion, type MenuSuggestionStatus } from "../data/menu-writer";
import { buildMenuPrompt, MENU_PROMPT_KEY, MENU_PROMPT_VERSION } from "../ai/prompts/menu.v1";

// Generacion real del menu por IA (B13). Arma el contrato MenuPromptInput SOLO con
// variables clinicas y objetivos (barrera PII estructural, regla 15): fenotipo, sector,
// rutas y los objetivos del protocolo; jamas nombre, documento ni contacto. Llama a la
// infra de B12 (provider con timeout + fallback) y persiste SIEMPRE una fila en
// ai_menu_suggestions (exito o fallo) para dejar procedencia. La sugerencia es un borrador:
// nunca se aplica al protocolo automaticamente, el profesional decide.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

function classifyFailure(e: unknown): MenuSuggestionStatus {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /timeout|timed out|abort/i.test(msg) ? "timeout" : "provider_error";
}

export async function generateMenu(
  evaluationId: string,
  actor: Actor,
): Promise<Result<{ status: MenuSuggestionStatus }>> {
  const [protocol, results] = await Promise.all([
    getTreatmentProtocol(evaluationId),
    getEvaluationResults(evaluationId),
  ]);
  if (!protocol || !results) return err(appError("not_found", "Tratamiento no encontrado."));
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError("conflict", "El diagnostico debe estar confirmado antes de generar el menu."),
    );
  }
  if (protocol.kcalObjetivo == null || protocol.proteinaGramos == null) {
    return err(
      appError(
        "validation",
        "Define y guarda el objetivo calorico y de proteina antes de generar el menu.",
      ),
    );
  }
  // El menu se arma desde el snapshot; si es de una era anterior del motor no tiene la forma
  // esperada (fenotipo/sector/rutas). Se bloquea con un mensaje claro en vez de tronar.
  if (!isEngineOutput(results.snapshot)) {
    return err(
      appError(
        "conflict",
        "El diagnostico de esta evaluacion tiene un formato anterior. Realiza una nueva evaluacion para generar el menu.",
      ),
    );
  }

  // Prompt de sistema: prefiere la version activa en BD (editable por admin, B14); si no hay,
  // cae al texto canonico en codigo. La procedencia guardada refleja la version usada.
  const activePrompt = await getActivePrompt(MENU_PROMPT_KEY);
  const promptVersion = `${MENU_PROMPT_KEY}@${activePrompt?.version ?? MENU_PROMPT_VERSION}`;

  const { structural, frSector, dfi } = results.snapshot;
  // Contrato PII-free: solo objetivos y variables clinicas seudonimizadas. El texto de
  // sistema es lo unico parametrizable; el mensaje de usuario se arma dentro de buildMenuPrompt.
  const messages = buildMenuPrompt(
    {
      kcalObjetivo: protocol.kcalObjetivo,
      proteinaGramos: protocol.proteinaGramos,
      restricciones: protocol.restricciones,
      fenotipoEstructural: structural.nombre,
      sectorFuncional: frSector.nombre,
      rutasAtencion: dfi.rutas,
    },
    activePrompt?.content,
  );

  let config;
  try {
    config = await resolveAiConfig();
  } catch {
    return err(appError("internal", "La IA no esta configurada. Contacta al administrador."));
  }

  try {
    const completion = await generateText(messages, config);
    await recordMenuSuggestion({
      treatmentId: protocol.treatmentId,
      provider: completion.provider,
      model: completion.model,
      promptVersion,
      generatedText: completion.text,
      rawResponse: {
        provider: completion.provider,
        model: completion.model,
        latency_ms: completion.latencyMs,
      },
      status: "success",
      latencyMs: completion.latencyMs,
      ...actor,
    });
    return ok({ status: "success" });
  } catch (e) {
    // Persistir el fallo tambien (procedencia). El proveedor/modelo del intento primario;
    // el mensaje de error nunca contiene PII (el prompt no la lleva).
    const status = classifyFailure(e);
    await recordMenuSuggestion({
      treatmentId: protocol.treatmentId,
      provider: config.provider,
      model: config.model,
      promptVersion,
      generatedText: null,
      rawResponse: { error: e instanceof AiError ? e.message : String(e), source: config.source },
      status,
      latencyMs: null,
      ...actor,
    });
    // Con config explicita del admin (source "db") no hay fallback: el fallo del proveedor
    // elegido se refleja tal cual, nombrandolo, para que quede claro que su config esta rota.
    const message =
      config.source === "db"
        ? `El proveedor de IA configurado (${config.provider}) fallo al generar el menu. Avisa al administrador para revisar la configuracion.`
        : "No se pudo generar el menu. Intenta de nuevo.";
    return err(appError("internal", message));
  }
}
