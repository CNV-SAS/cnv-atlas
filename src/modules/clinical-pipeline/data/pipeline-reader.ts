import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  bisMeasurements,
  bisRawValues,
  evaluations,
  indicatorDefinitions,
  modelVersions,
  patientProfiles,
  surveyAnswers,
  surveyResponses,
} from "@/db/schema";

// Lecturas de los insumos del pipeline por Drizzle owner (computo clinico server-side,
// como los escritores). La autorizacion (que la evaluacion sea del profesional) se
// verifica antes en el action bajo RLS (getEvaluationOwnership), regla dura 3.

export type PipelineInputs = {
  patientId: string;
  sex: string | null;
  birthDate: string | null;
  surveyVersionId: string | null;
  surveyAnswers: Record<string, string>;
  bisRaw: Record<string, number>;
  hasBis: boolean;
};

export async function readPipelineInputs(evaluationId: string): Promise<PipelineInputs | null> {
  const [ev] = await db
    .select({ patientId: evaluations.patientId })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  if (!ev) return null;

  const [profile] = await db
    .select({ sex: patientProfiles.sex, birthDate: patientProfiles.birthDate })
    .from(patientProfiles)
    .where(eq(patientProfiles.patientId, ev.patientId))
    .limit(1);

  // Respuesta de encuesta mas reciente de la evaluacion (recoleccion pura de B7).
  const [response] = await db
    .select({ id: surveyResponses.id, surveyVersionId: surveyResponses.surveyVersionId })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, evaluationId))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(1);

  const answers: Record<string, string> = {};
  let surveyVersionId: string | null = null;
  if (response) {
    surveyVersionId = response.surveyVersionId;
    const rows = await db
      .select({ questionId: surveyAnswers.questionId, answerValue: surveyAnswers.answerValue })
      .from(surveyAnswers)
      .where(eq(surveyAnswers.responseId, response.id));
    for (const r of rows) answers[r.questionId] = r.answerValue ?? "";
  }

  // Crudos BIS de la medicion de la evaluacion (B8): nombre normalizado -> valor.
  const [measurement] = await db
    .select({ id: bisMeasurements.id })
    .from(bisMeasurements)
    .where(eq(bisMeasurements.evaluationId, evaluationId))
    .limit(1);

  const bisRaw: Record<string, number> = {};
  const hasBis = Boolean(measurement);
  if (measurement) {
    const rows = await db
      .select({ name: bisRawValues.variableName, value: bisRawValues.value })
      .from(bisRawValues)
      .where(eq(bisRawValues.measurementId, measurement.id));
    for (const r of rows) bisRaw[r.name] = Number(r.value);
  }

  return {
    patientId: ev.patientId,
    sex: profile?.sex ?? null,
    birthDate: profile?.birthDate ?? null,
    surveyVersionId,
    surveyAnswers: answers,
    bisRaw,
    hasBis,
  };
}

export type ActiveModel = {
  id: string;
  versionName: string;
  rulesVersion: string;
  indicatorDefIdByCode: Record<string, string>;
};

// La version del modelo activa (una sola, indice parcial) + el mapa codigo -> id de sus
// indicator_definitions, para sellar la constelacion y resolver los FK al persistir.
export async function readActiveModel(): Promise<ActiveModel | null> {
  const [model] = await db
    .select({
      id: modelVersions.id,
      versionName: modelVersions.versionName,
      rulesVersion: modelVersions.rulesVersion,
    })
    .from(modelVersions)
    .where(eq(modelVersions.status, "active"))
    .limit(1);
  if (!model) return null;

  const defs = await db
    .select({ id: indicatorDefinitions.id, code: indicatorDefinitions.code })
    .from(indicatorDefinitions)
    .where(eq(indicatorDefinitions.modelVersionId, model.id));

  const indicatorDefIdByCode: Record<string, string> = {};
  for (const d of defs) indicatorDefIdByCode[d.code] = d.id;

  return {
    id: model.id,
    versionName: model.versionName,
    rulesVersion: model.rulesVersion,
    indicatorDefIdByCode,
  };
}
