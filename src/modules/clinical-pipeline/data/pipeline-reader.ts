import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  bisMeasurements,
  bisRawValues,
  efrStates,
  evaluations,
  frSectors,
  indicatorDefinitions,
  modelVersions,
  patientProfiles,
  phenotypes,
  surveyAnswers,
  surveyQuestions,
  surveyResponses,
} from "@/db/schema";

import type { SurveyFieldAnswer } from "../services/build-engine-input";
import { computeSurveyGaps, type SurveyGap } from "../services/survey-completeness";

// Lecturas de los insumos del pipeline por Drizzle owner (computo clinico server-side,
// como los escritores). La autorizacion (que la evaluacion sea del profesional) se
// verifica antes en el action bajo RLS (getEvaluationOwnership), regla dura 3.

export type PipelineInputs = {
  patientId: string;
  evaluationType: string; // inicial | seguimiento: decide si el ciclo registra un followup
  sex: string | null;
  birthDate: string | null;
  surveyVersionId: string | null;
  surveyAnswers: SurveyFieldAnswer[]; // solo las preguntas con field_key (alimentan el motor)
  // Todos los field_key que DECLARA la version (respondidos o no): la lista contra la cual el
  // motor mide dfi.complete (regla 7). Vacia si no hay respuesta/version (el orquestador falla).
  expectedFieldKeys: string[];
  // Huecos de la encuesta COMPLETA (las 64, no solo las 13 del diagnostico), por dominio y en orden.
  // Vacio = completa. El gate al generar exige que este vacio (Gildardo §1). Ver survey-completeness.
  surveyGaps: SurveyGap[];
  bisRaw: Record<string, number>;
  hasBis: boolean;
};

export async function readPipelineInputs(evaluationId: string): Promise<PipelineInputs | null> {
  const [ev] = await db
    .select({ patientId: evaluations.patientId, evaluationType: evaluations.type })
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

  // Respuestas resueltas a su field_key via join con survey_questions: solo las que
  // alimentan el motor (field_key no nulo). El motor las lee por d-field, no por questionId.
  const answers: SurveyFieldAnswer[] = [];
  let surveyVersionId: string | null = null;
  let expectedFieldKeys: string[] = [];
  let surveyGaps: SurveyGap[] = [];
  if (response) {
    surveyVersionId = response.surveyVersionId;
    const rows = await db
      .select({
        fieldKey: surveyQuestions.fieldKey,
        type: surveyQuestions.questionType,
        answerValue: surveyAnswers.answerValue,
      })
      .from(surveyAnswers)
      .innerJoin(surveyQuestions, eq(surveyAnswers.questionId, surveyQuestions.id))
      .where(eq(surveyAnswers.responseId, response.id));
    for (const r of rows) {
      if (r.fieldKey) answers.push({ fieldKey: r.fieldKey, type: r.type, value: r.answerValue ?? "" });
    }
    // La lista de campos del DIAGNOSTICO declarados por la version: las preguntas con field_key Y
    // used_in_diagnosis (respondidas o no). Contra ella se mide dfi.complete (regla 7). OJO CON EL
    // NOMBRE: dfi.complete mide la completitud de los INSUMOS DEL DIAGNOSTICO, no de la encuesta entera.
    // Los campos que solo alimentan el TRATAMIENTO (medicamentos, estres, sed) tienen field_key pero
    // used_in_diagnosis=false, asi que NO entran aqui: no gatean la emision del diagnostico (seria
    // incorrecto suprimir el diagnostico por un dato que no lo alimenta). Ver PLAN_FIELDKEYS_TRATAMIENTO.
    const declared = await db
      .select({ fieldKey: surveyQuestions.fieldKey })
      .from(surveyQuestions)
      .where(and(eq(surveyQuestions.surveyVersionId, surveyVersionId), eq(surveyQuestions.usedInDiagnosis, true)));
    expectedFieldKeys = declared
      .map((r) => r.fieldKey)
      .filter((k): k is string => k != null);

    // Completitud de la ENCUESTA ENTERA (las 64 de la version), no solo las del diagnostico: toda
    // pregunta con su respuesta (o sin ella). El gate al generar exige que este completa (Gildardo §1).
    // LEFT JOIN para incluir las preguntas SIN fila de respuesta (ausentes = sin responder).
    const allQuestions = await db
      .select({
        section: surveyQuestions.section,
        orderIndex: surveyQuestions.orderIndex,
        answerValue: surveyAnswers.answerValue,
      })
      .from(surveyQuestions)
      .leftJoin(
        surveyAnswers,
        and(
          eq(surveyAnswers.questionId, surveyQuestions.id),
          eq(surveyAnswers.responseId, response.id),
        ),
      )
      .where(eq(surveyQuestions.surveyVersionId, surveyVersionId));
    surveyGaps = computeSurveyGaps(allQuestions);
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
    evaluationType: ev.evaluationType,
    sex: profile?.sex ?? null,
    birthDate: profile?.birthDate ?? null,
    surveyVersionId,
    surveyAnswers: answers,
    expectedFieldKeys,
    surveyGaps,
    bisRaw,
    hasBis,
  };
}

export type ActiveModel = {
  id: string;
  versionName: string;
  rulesVersion: string;
  indicatorDefIdByCode: Record<string, string>;
  // Mapas clave -> id para los FK del diagnostico: fenotipo estructural (STRUCT, code
  // "A_B"...) y sector FyR (code "3_1"...). El writer los resuelve por la clave del output.
  phenotypeIdByKey: Record<string, string>;
  frSectorIdByKey: Record<string, string>;
};

// La version del modelo activa (una sola, indice parcial) + los mapas codigo/clave -> id
// de sus catalogos, para sellar la constelacion y resolver los FK al persistir.
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

  const [defs, phenos, sectors] = await Promise.all([
    db
      .select({ id: indicatorDefinitions.id, code: indicatorDefinitions.code })
      .from(indicatorDefinitions)
      .where(eq(indicatorDefinitions.modelVersionId, model.id)),
    db
      .select({ id: phenotypes.id, code: phenotypes.code })
      .from(phenotypes)
      .where(eq(phenotypes.modelVersionId, model.id)),
    db
      .select({ id: frSectors.id, code: frSectors.code })
      .from(frSectors)
      .where(eq(frSectors.modelVersionId, model.id)),
  ]);

  const indicatorDefIdByCode: Record<string, string> = {};
  for (const d of defs) indicatorDefIdByCode[d.code] = d.id;
  const phenotypeIdByKey: Record<string, string> = {};
  for (const p of phenos) phenotypeIdByKey[p.code] = p.id;
  const frSectorIdByKey: Record<string, string> = {};
  for (const s of sectors) frSectorIdByKey[s.code] = s.id;

  return {
    id: model.id,
    versionName: model.versionName,
    rulesVersion: model.rulesVersion,
    indicatorDefIdByCode,
    phenotypeIdByKey,
    frSectorIdByKey,
  };
}

// Contenido clinico del estado EFR (nombre/mecanismo/biomarcadores/riesgos/nutraceuticos) del
// registry. Se lee por BANDAS, no por numero: la llave (model_version, bandas) es inmutable (la
// renumeracion cambio el numero, no el mapeo bandas->contenido). Se congela en el snapshot al
// DIAGNOSTICAR (ii): la vista de resultados lee la evidencia clinica del snapshot inmutable, no
// del registry vivo, para que una edicion futura del contenido no re-escriba diagnosticos
// historicos. Null si el registry no tiene el estado (defensivo; no ocurre con bandas validas).
export type EfrContent = {
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

export async function readEfrContent(
  modelVersionId: string,
  bands: { ifc: number; irc: number; ffmi: number; fmi: number },
): Promise<EfrContent | null> {
  const [row] = await db
    .select({
      diagnosisName: efrStates.diagnosisName,
      mechanism: efrStates.mechanism,
      biomarkers: efrStates.biomarkers,
      risks: efrStates.risks,
      suggestedNutraceuticals: efrStates.suggestedNutraceuticals,
    })
    .from(efrStates)
    .where(
      and(
        eq(efrStates.modelVersionId, modelVersionId),
        eq(efrStates.ifcBand, bands.ifc),
        eq(efrStates.ircBand, bands.irc),
        eq(efrStates.ffmiBand, bands.ffmi),
        eq(efrStates.fmiBand, bands.fmi),
      ),
    )
    .limit(1);
  return row ?? null;
}
