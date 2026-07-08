import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { isEngineOutput } from "@/clinical-engine";
import { resolveAiConfig } from "@/lib/ai/config";
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

// Version de prompt que se guarda como procedencia (clave@version de la plantilla en codigo).
const PROMPT_VERSION = `${MENU_PROMPT_KEY}@${MENU_PROMPT_VERSION}`;

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

  const { structural, frSector, dfi } = results.snapshot;
  // Contrato PII-free: solo objetivos y variables clinicas seudonimizadas.
  const messages = buildMenuPrompt({
    kcalObjetivo: protocol.kcalObjetivo,
    proteinaGramos: protocol.proteinaGramos,
    restricciones: protocol.restricciones,
    fenotipoEstructural: structural.nombre,
    sectorFuncional: frSector.nombre,
    rutasAtencion: dfi.rutas,
  });

  let config;
  try {
    config = resolveAiConfig();
  } catch {
    return err(appError("internal", "La IA no esta configurada. Contacta al administrador."));
  }

  try {
    const completion = await generateText(messages, config);
    await recordMenuSuggestion({
      treatmentId: protocol.treatmentId,
      provider: completion.provider,
      model: completion.model,
      promptVersion: PROMPT_VERSION,
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
      promptVersion: PROMPT_VERSION,
      generatedText: null,
      rawResponse: { error: e instanceof AiError ? e.message : String(e) },
      status,
      latencyMs: null,
      ...actor,
    });
    return err(appError("internal", "No se pudo generar el menu. Intenta de nuevo."));
  }
}
