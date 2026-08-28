import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { computeProtocoloEfectivo, isEngineOutput } from "@/clinical-engine";
import { resolveAiConfig } from "@/lib/ai/config";
import { getActivePrompt } from "@/lib/ai/prompts";
import { AiError, generateText } from "@/lib/ai/provider";
import { reportServerError } from "@/lib/observability/report-error";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";

import { getTreatmentProtocol } from "../data/treatment-reader";
import { recordMenuSuggestion, type MenuSuggestionStatus } from "../data/menu-writer";
import { requireNutricionista } from "./require-profession";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { patronDeclarado } from "./patron-declarado";

import {
  buildMenuPrompt,
  MENU_PROMPT_KEY,
  MENU_PROMPT_VERSION,
  parseMenuEstructurado,
} from "../ai/prompts/menu.v3";

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
  // Guard interino de ambito de practica: sin profesion configurada no se escribe (generar el
  // menu persiste una sugerencia). Ver require-profession.ts.
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError("conflict", "El diagnóstico debe estar confirmado antes de generar el menu."),
    );
  }
  // El objetivo YA NO es un input manual (checkpoint 2, colapso de los dos objetivos): sale de la CADENA
  // CALORICA, fuente unica. Se recomputa el efectivo con los ajustes del profesional sobre el snapshot
  // sellado, la MISMA funcion que sella la aprobacion. La cadena SIEMPRE produce un objetivo (kcalObj =
  // override ?? GET de mantenimiento), asi que el viejo bloqueo "objetivo nulo" ya no aplica; lo que si
  // puede faltar es el snapshot (tratamiento pre-snapshot): sin el no hay cadena que computar. Guarda
  // defensiva contra el null-deref, no un gate de "guarda el objetivo".
  if (!protocol.protocolSuggested) {
    return err(
      appError("conflict", "El protocolo aún no se ha calculado; no se puede generar el menú."),
    );
  }
  const efectivo = computeProtocoloEfectivo(protocol.protocolSuggested, {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    pesoMeta: protocol.adjPesoMeta,
  });
  // El menu se arma desde el snapshot; si es de una era anterior del motor no tiene la forma
  // esperada (fenotipo/sector/rutas). Se bloquea con un mensaje claro en vez de tronar.
  if (!isEngineOutput(results.snapshot)) {
    return err(
      appError(
        "conflict",
        "El diagnóstico de esta evaluación tiene un formato anterior. Realiza una nueva evaluación para generar el menu.",
      ),
    );
  }

  // Prompt de sistema: prefiere la version activa en BD (editable por admin, B14); si no hay,
  // cae al texto canonico en codigo. La procedencia guardada refleja la version usada.
  const activePrompt = await getActivePrompt(MENU_PROMPT_KEY);
  // Procedencia con las DOS versiones, que son independientes: "@N" es la del texto de SISTEMA (la
  // que el admin edita en BD; 1 si no hay ninguna activa) y "+uM" la del CONTRATO en codigo (el
  // mensaje de usuario, menu.vM.ts). Antes solo se guardaba la del sistema, asi que un cambio del
  // contrato -como el bloque de restricciones del modelo, v2- habria quedado registrado como si el
  // prompt no hubiera cambiado.
  const promptVersion = `${MENU_PROMPT_KEY}@${activePrompt?.version ?? 1}+u${MENU_PROMPT_VERSION}`;

  const { structural, frSector, dfi } = results.snapshot;
  // Contrato PII-free: solo objetivos y variables clinicas seudonimizadas. El texto de
  // sistema es lo unico parametrizable; el mensaje de usuario se arma dentro de buildMenuPrompt.
  // PATRON ALIMENTARIO declarado (3.2b de Gildardo del 26): sin esto el generador le propone carne a un
  // vegano. Es leer un campo de la encuesta, no una tabla de exclusiones (ver patron-declarado).
  const dominios = await getSurveyAnswersForEvaluation(evaluationId);
  const patron = patronDeclarado(
    (dominios ?? []).flatMap((d) => d.questions.map((q) => ({ fieldKey: q.fieldKey, valor: q.answerValue }))),
  );

  const messages = buildMenuPrompt(
    {
      kcalObjetivo: efectivo.calorico.kcalObj,
      proteinaGramos: efectivo.calorico.protG,
      // Las DOS listas, separadas (v2): las del MODELO son la salida del motor con su referencia
      // clinica y son no negociables; las del PROFESIONAL son aditivas. Fundirlas perderia ambas cosas.
      restriccionesModelo: protocol.protocolSuggested.restricciones ?? [],
      restriccionesProfesional: protocol.restricciones,
      fenotipoEstructural: structural.nombre,
      sectorFuncional: frSector.nombre,
      rutasAtencion: dfi.rutas,
      patronAlimentario: patron,
    },
    activePrompt?.content,
  );

  let config;
  try {
    config = await resolveAiConfig();
  } catch (e) {
    // Con la IA bien configurada (B14), un fallo aqui es inesperado (p. ej. leer la config de la BD):
    // que deje rastro en vez de leerse como "no configurada" a secas.
    reportServerError("generateMenu.resolveConfig", e);
    return err(appError("internal", "La IA no esta configurada. Contacta al administrador."));
  }

  try {
    const completion = await generateText(messages, config);

    // CAPA 3: el chequeo exacto. El menu se parsea a la forma del contrato v3 y se cruza alimento contra
    // alimento. Si no parsea NO se cruza, y entonces la sugerencia no puede afirmarse revisada: se
    // de [] que significa "revisado y limpio").
    const menuJson = parseMenuEstructurado(completion.text);
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
      menuJson,
      status: menuJson ? "success" : "parse_failed",
      latencyMs: completion.latencyMs,
      ...actor,
    });
    return ok({ status: menuJson ? "success" : "parse_failed" });
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
      menuJson: null,
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
