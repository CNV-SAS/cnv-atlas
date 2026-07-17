import "server-only";

import { runEngine } from "@/clinical-engine";
import { appError, err, ok, type Result } from "@/core/errors";

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

  try {
    const written = await writePipeline({
      evaluationId: input.evaluationId,
      patientId: inputs.patientId,
      evaluationType: inputs.evaluationType,
      output,
      efrContent,
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
