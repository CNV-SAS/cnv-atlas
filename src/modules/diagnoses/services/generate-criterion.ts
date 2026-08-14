import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { type IndicatorClass, isEngineOutput } from "@/clinical-engine";
import { resolveAiConfig } from "@/lib/ai/config";
import { getActivePrompt } from "@/lib/ai/prompts";
import { AiError, generateText } from "@/lib/ai/provider";
import { reportServerError } from "@/lib/observability/report-error";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";

import { getDiagnosisCriterion } from "../data/diagnosis-notes-reader";
import {
  type CriterionSuggestionStatus,
  recordCriterionSuggestion,
} from "../data/criterion-suggestion-writer";
import {
  buildCriterionPrompt,
  CRITERION_PROMPT_KEY,
  CRITERION_PROMPT_VERSION,
  type CriterionPromptInput,
} from "../ai/prompts/criterion.v1";

// Generacion del BORRADOR de criterio por IA (h). Arma el contrato CriterionPromptInput SOLO con
// variables clinicas del snapshot (barrera PII, regla 15): estado EFR, fenotipos, indicadores y dominios;
// jamas nombre, documento ni contacto (esos ni siquiera viajan en el EngineOutput). Devuelve el TEXTO al
// cliente para que caiga en el campo editable; NO se aplica solo. Persiste SIEMPRE una fila de
// procedencia (exito o fallo). No exige diagnostico confirmado: el criterio se forma al revisar.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

function classifyFailure(e: unknown): CriterionSuggestionStatus {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /timeout|timed out|abort/i.test(msg) ? "timeout" : "provider_error";
}

// Indicadores a DESTACAR: los que el clasificador dejo fuera de la banda normal (k !== 2). El nivel es la
// etiqueta del propio clasificador (lleva la direccion: "superior", "bajo", etc.). k ausente se incluye
// (mejor sobre-mostrar que ocultar). Clave del mapa = codigo del registry (mismo que indicatorNames).
function alteredIndicators(
  classifications: Record<string, IndicatorClass>,
  names: Record<string, string>,
): { nombre: string; nivel: string }[] {
  const out: { nombre: string; nivel: string }[] = [];
  for (const [code, cls] of Object.entries(classifications)) {
    if (!cls || cls.k === 2) continue;
    out.push({ nombre: names[code] ?? code, nivel: cls.label });
  }
  return out;
}

export async function generateCriterion(
  evaluationId: string,
  actor: Actor,
): Promise<Result<{ text: string }>> {
  // getDiagnosisCriterion resuelve el diagnosisId Y el ownership por RLS (null si no es del profesional o
  // no hay diagnostico). getEvaluationResults trae el snapshot (tambien RLS).
  const [criterion, results] = await Promise.all([
    getDiagnosisCriterion(evaluationId),
    getEvaluationResults(evaluationId),
  ]);
  if (!criterion || !results) return err(appError("not_found", "Diagnóstico no encontrado."));
  if (!isEngineOutput(results.snapshot)) {
    return err(
      appError(
        "conflict",
        "El diagnóstico de esta evaluación tiene un formato anterior. Realiza una nueva evaluación para generar el borrador.",
      ),
    );
  }

  const snap = results.snapshot;
  const efr = results.efrState;
  // Contrato PII-free: solo variables clinicas del snapshot. Nunca patientName ni documentLabel (que
  // viven aparte, fuera del EngineOutput).
  const input: CriterionPromptInput = {
    estadoEfr: efr?.diagnosisName ?? snap.efrPhenotype.diagnostico,
    mecanismo: efr?.mechanism ?? null,
    biomarcadores: efr?.biomarkers ?? null,
    riesgos: efr?.risks ?? null,
    fenotipoEstructural: snap.structural.nombre,
    sectorFuncional: snap.frSector.nombre,
    indicadoresAlterados: alteredIndicators(snap.classifications, results.indicatorNames),
    dominios: snap.dfi.domains.map((d) => ({ nombre: d.nombre, nivel: d.clasif })),
    riesgoIntegrado: `${snap.dfi.riesgo.nivel} (score ${snap.dfi.riesgo.score})`,
    rutas: snap.dfi.rutas,
  };

  // Prompt de sistema: prefiere la version activa en BD (editable por admin); si no, el texto canonico.
  const activePrompt = await getActivePrompt(CRITERION_PROMPT_KEY);
  const promptVersion = `${CRITERION_PROMPT_KEY}@${activePrompt?.version ?? CRITERION_PROMPT_VERSION}`;
  const messages = buildCriterionPrompt(input, activePrompt?.content);

  let config;
  try {
    config = await resolveAiConfig();
  } catch (e) {
    reportServerError("generateCriterion.resolveConfig", e);
    return err(appError("internal", "La IA no esta configurada. Contacta al administrador."));
  }

  try {
    const completion = await generateText(messages, config);
    await recordCriterionSuggestion({
      diagnosisId: criterion.diagnosisId,
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
    return ok({ text: completion.text });
  } catch (e) {
    const status = classifyFailure(e);
    await recordCriterionSuggestion({
      diagnosisId: criterion.diagnosisId,
      provider: config.provider,
      model: config.model,
      promptVersion,
      generatedText: null,
      rawResponse: { error: e instanceof AiError ? e.message : String(e), source: config.source },
      status,
      latencyMs: null,
      ...actor,
    });
    const message =
      config.source === "db"
        ? `El proveedor de IA configurado (${config.provider}) fallo al generar el borrador. Avisa al administrador.`
        : "No se pudo generar el borrador. Escribe tu criterio a mano.";
    return err(appError("internal", message));
  }
}
