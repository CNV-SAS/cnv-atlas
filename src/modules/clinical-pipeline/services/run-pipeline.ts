import "server-only";

import * as Sentry from "@sentry/nextjs";

import { computeProtocolo, runEngine, type ProtocoloSnapshot } from "@/clinical-engine";
import { resolveRutasContent } from "@/clinical-engine/rutas-content";
import { appError, err, ok, type Result } from "@/core/errors";
import { getSealedValidityCaveats } from "@/modules/bis-intake/data/bis-conditions-reader";

import { readActiveModel, readEfrContent, readPipelineInputs } from "../data/pipeline-reader";
import { PipelineAlreadyRunError, writePipeline } from "../data/pipeline-writer";
import { buildEngineInput } from "./build-engine-input";

// Orquesta la propagacion: leer insumos -> armar EngineInput -> runEngine (stub) ->
// persistir, todo mapeado a Result (el action no hace throw). La re-propagacion se
// mapea a conflicto. La autorizacion y el ownership ya se verificaron en el action.

export type RunPipelineInput = {
  evaluationId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type RunPipelineOutput = {
  diagnosisId: string;
  treatmentId: string;
  reportId: string;
  indicatorCount: number;
};

export async function runClinicalPipeline(
  input: RunPipelineInput,
): Promise<Result<RunPipelineOutput>> {
  const inputs = await readPipelineInputs(input.evaluationId);
  if (!inputs) return err(appError("not_found", "Evaluacion no encontrada."));
  if (!inputs.hasBis) {
    return err(appError("validation", "La evaluacion no tiene una medicion BIS importada."));
  }
  if (!inputs.surveyVersionId) {
    return err(appError("validation", "La evaluacion no tiene respuestas de encuesta."));
  }

  const model = await readActiveModel();
  if (!model) return err(appError("internal", "No hay una version del modelo activa."));

  const engineInput = buildEngineInput(
    {
      sex: inputs.sex,
      birthDate: inputs.birthDate,
      surveyAnswers: inputs.surveyAnswers,
      bisRaw: inputs.bisRaw,
    },
    { version: model.versionName, rulesVersion: model.rulesVersion },
    new Date(),
  );

  const output = runEngine(engineInput);

  // Protocolo sugerido (T2 A3): PURO, se computa aqui (fuera de la transaccion) y se SELLA en
  // writePipeline. Un fallo del protocolo NO degrada el diagnostico: se sella protocol_suggested =
  // null. Se elige NULL, no un objeto de error, porque el trigger permite null -> valor: el backfill
  // sigue posible tras arreglar el bug (un objeto de error, congelado, cerraria esa via). El
  // profesional lo maneja en T2b (mensaje explicito). En la practica no se alcanza: peso/talla son
  // ENGINE_REQUIRED. RASTRO del fallo, para que uno sistematico no sea invisible: (1) audit log
  // protocol.compute_failed, durable y queryable en BD (lo escribe writePipeline inline, regla 8), y
  // (2) Sentry, la ALERTA en prod (un console.error en Vercel rota y nadie lo mira). El motivo es de
  // nivel motor (nombres de campo/rango), no PII, y Sentry ademas scrubbea.
  let protocolSuggested: ProtocoloSnapshot | null = null;
  let protocolFailMotive: string | null = null;
  try {
    protocolSuggested = computeProtocolo(engineInput, output);
    if (!protocolSuggested) {
      protocolFailMotive = "computeProtocolo devolvio null (sin composicion minima: peso/talla)";
    }
  } catch (e) {
    protocolFailMotive = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, {
      tags: { area: "protocol-compute", evaluationId: input.evaluationId },
    });
    console.error(`[pipeline] computeProtocolo fallo (evaluacion ${input.evaluationId}):`, e);
  }

  // (ii) Contenido clinico del estado EFR, leido del registry por BANDAS al diagnosticar, para
  // CONGELARLO en el snapshot: la vista de resultados no re-deriva evidencia del registry vivo.
  // Es REQUERIDO: un estado con bandas validas siempre existe en el registry; si faltara, es un
  // problema de integridad del registry y se falla fuerte (no se persiste un snapshot a medias).
  const efrContent = await readEfrContent(model.id, output.efrPhenotype.bands);
  if (!efrContent) {
    return err(
      appError("internal", "El registry no tiene el contenido del estado EFR diagnosticado."),
    );
  }

  // Caveats de validez (de las condiciones de la toma BIS selladas), para congelarlos en el
  // snapshot: bajo que condicion(es) que comprometen la validez se hizo la medicion.
  const validityCaveats = await getSealedValidityCaveats(input.evaluationId);

  // Contenido de las rutas de atencion ACTIVAS (verbatim de Gildardo), para congelarlo en el
  // snapshot: lo que se prescribio ese dia. Se resuelve de dfi.rutas (ids) al contenido.
  const rutasContent = resolveRutasContent(output.dfi.rutas);

  try {
    const written = await writePipeline({
      evaluationId: input.evaluationId,
      patientId: inputs.patientId,
      evaluationType: inputs.evaluationType,
      output,
      efrContent,
      validityCaveats,
      rutasContent,
      protocolSuggested,
      protocolFailMotive,
      surveyVersionId: inputs.surveyVersionId,
      modelVersionId: model.id,
      indicatorDefIdByCode: model.indicatorDefIdByCode,
      phenotypeIdByKey: model.phenotypeIdByKey,
      frSectorIdByKey: model.frSectorIdByKey,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
    return ok(written);
  } catch (e) {
    if (e instanceof PipelineAlreadyRunError) {
      return err(appError("conflict", "Esta evaluacion ya tiene un diagnostico generado."));
    }
    throw e; // inesperado: que suba (lo captura el action / Sentry)
  }
}
