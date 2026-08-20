import "server-only";

import * as Sentry from "@sentry/nextjs";
import { desc, eq } from "drizzle-orm";

import { computeProtocolo, runEngine, type ProtocoloSnapshot } from "@/clinical-engine";
import { resolveRutasContent } from "@/clinical-engine/rutas-content";
import { db } from "@/db";
import {
  bisMeasurements,
  bisRawValues,
  clinicalCorrections,
  diagnoses,
  evaluations,
  professionalProfiles,
  surveyAnswers,
  surveyQuestions,
  surveyResponses,
} from "@/db/schema";
import { appError, err, ok, type Result } from "@/core/errors";
import { CONSENT_VERSION } from "@/modules/consent/versions";
import { recordAudit } from "@/modules/audit/log";
import { getSealedValidityCaveats } from "@/modules/bis-intake/data/bis-conditions-reader";
import {
  readActiveModel,
  readEfrContent,
  readPipelineInputs,
} from "@/modules/clinical-pipeline/data/pipeline-reader";
import { writePipeline } from "@/modules/clinical-pipeline/data/pipeline-writer";
import { buildEngineInput, type SurveyFieldAnswer } from "@/modules/clinical-pipeline/services/build-engine-input";
import {
  computeSurveyGaps,
  formatIncompleteSurveyMessage,
} from "@/modules/clinical-pipeline/services/survey-completeness";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";

// Flujo de correccion post-diagnostico, S1 (el motor, sin UI). Ver docs/PLAN_FLUJO_CORRECCION.md.
// NO edita ni borra nada: crea una VERSION NUEVA de la evaluacion (insumos copiados con la
// correccion, diagnostico/tratamiento/reporte RECALCULADOS) y la encadena a la vieja via
// clinical_corrections (que por trigger marca la vieja como reemplazada). Todo en UNA transaccion:
// si el pipeline (o cualquier paso) falla, revierte entero y la vieja queda intacta y vigente.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

export type CorrectEvaluationInput = {
  evaluationId: string; // la evaluacion VIGENTE que se corrige
  // Correcciones de respuestas de encuesta: por pregunta (questionId) su nuevo valor. Solo encuesta
  // en este bloque (PLAN (f)); antropometria/condiciones reusan el mecanismo con su propia UI luego.
  correctedAnswers: { questionId: string; answerValue: string }[];
  reason: string; // motivo obligatorio (PLAN (d))
  triggerType: "correccion_profesional" | "recalibracion_ciencia";
  confirmed: boolean; // confirmacion explicita (Condicion 4): acto irreversible
};

export type CorrectEvaluationResult = {
  oldEvaluationId: string;
  newEvaluationId: string;
  diagnosisId: string;
  // La version del modelo cambio entremedio: aviso condicional (PLAN (b)). El modelo es el frozen
  // en disco, no se fija; se sella la version REAL y esto le dice a la UI si debe avisar.
  modelChanged: boolean;
};

export async function correctEvaluation(
  input: CorrectEvaluationInput,
  actor: Actor,
): Promise<Result<CorrectEvaluationResult>> {
  // --- Gates que no tocan BD de escritura (fallan barato, antes de computar) ---
  if (!input.confirmed) {
    return err(appError("validation", "La corrección requiere confirmación explicita."));
  }
  if (!input.reason.trim()) {
    return err(appError("validation", "Escribe el motivo de la corrección para continuar."));
  }

  const [ev] = await db
    .select({
      id: evaluations.id,
      patientId: evaluations.patientId,
      professionalId: evaluations.professionalId,
      organizationId: evaluations.organizationId,
      type: evaluations.type,
      supersededAt: evaluations.supersededAt,
    })
    .from(evaluations)
    .where(eq(evaluations.id, input.evaluationId))
    .limit(1);
  if (!ev) return err(appError("not_found", "Evaluación no encontrada."));

  // Gate vigente: solo se corrige la cabeza de la cadena (el trigger tambien lo bloquea, esto da
  // un mensaje claro en vez del texto del trigger).
  if (ev.supersededAt) {
    return err(
      appError("conflict", "Esta evaluación ya fue corregida; corrige la versión vigente."),
    );
  }

  // Gate asignacion (defensa en profundidad, regla 3): el professional_profile del actor debe ser el
  // asignado a la evaluacion. Admin no (acto clinico, igual que approveProtocol). Se resuelve por el
  // db owner (no el cliente RLS con cookies): el servicio corre su cascada por db, es consistente y
  // no depende del request scope.
  const [prof] = await db
    .select({ id: professionalProfiles.id })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.profileId, actor.actorId))
    .limit(1);
  if (!prof || prof.id !== ev.professionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }

  const inputs = await readPipelineInputs(input.evaluationId);
  if (!inputs) return err(appError("not_found", "Evaluación no encontrada."));
  if (!inputs.hasBis) {
    return err(appError("validation", "La evaluación no tiene una medición BIS."));
  }
  if (!inputs.surveyVersionId || inputs.expectedFieldKeys.length === 0) {
    return err(appError("validation", "La evaluación no tiene una encuesta valida."));
  }

  // Gate version de encuesta (#2): el frozen esta acoplado char-by-char a la encuesta VIGENTE. Una
  // evaluacion de una version anterior no se puede recalcular con el motor de hoy. Se RESTRINGE.
  const active = await getActiveSurvey();
  if (!active || active.surveyVersionId !== inputs.surveyVersionId) {
    return err(
      appError(
        "validation",
        "Esta evaluación se hizo con una versión anterior del cuestionario y no puede recalcularse con el modelo actual.",
      ),
    );
  }

  // --- Leer la respuesta de encuesta vigente y sus respuestas (con questionId + field_key), aplicar
  // la correccion en memoria. La misma respuesta se copia corregida y alimenta el motor. ---
  const [response] = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, input.evaluationId))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(1);
  if (!response) return err(appError("validation", "La evaluación no tiene respuestas de encuesta."));

  const answers = await db
    .select({
      questionId: surveyAnswers.questionId,
      fieldKey: surveyQuestions.fieldKey,
      type: surveyQuestions.questionType,
      answerValue: surveyAnswers.answerValue,
    })
    .from(surveyAnswers)
    .innerJoin(surveyQuestions, eq(surveyQuestions.id, surveyAnswers.questionId))
    .where(eq(surveyAnswers.responseId, response.id));

  // Catalogo COMPLETO de preguntas de la version de encuesta (no solo las respondidas). Sirve para
  // dos cosas: validar que una correccion apunta a una pregunta real, y COMPLETAR (agregar la
  // respuesta que faltaba), que necesita el type/field_key de una pregunta sin fila de respuesta.
  const catalog = await db
    .select({
      id: surveyQuestions.id,
      type: surveyQuestions.questionType,
      fieldKey: surveyQuestions.fieldKey,
      section: surveyQuestions.section,
      orderIndex: surveyQuestions.orderIndex,
    })
    .from(surveyQuestions)
    .where(eq(surveyQuestions.surveyVersionId, inputs.surveyVersionId));
  const catalogByQuestion = new Map(catalog.map((q) => [q.id, q]));

  // Cada correccion debe apuntar a una pregunta de ESTA encuesta. Puede NO tener respuesta previa:
  // eso es COMPLETAR (agregar la respuesta que faltaba), el flujo normal cuando el paciente dejo la
  // encuesta a medias y el profesional la termina en consulta (Gildardo). Solo se rechaza un
  // questionId que no pertenece al cuestionario (imposible desde la UI; defensa).
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const corrections = new Map(input.correctedAnswers.map((c) => [c.questionId, c.answerValue]));
  for (const qid of corrections.keys()) {
    if (!catalogByQuestion.has(qid)) {
      return err(
        appError("validation", "Esa pregunta no pertenece a este cuestionario; recarga la evaluación e intenta de nuevo."),
      );
    }
  }

  // Cambios reales: al menos UNA respuesta que de verdad cambie (completar cuenta: de "" a un valor).
  // Sin ninguno no hay nada que hacer; generar una version identica rehace la cascada, pierde el
  // tratamiento e invalida la aprobacion sin que nada haya cambiado (la UI ya lo bloquea; defensa).
  const realChanges = [...corrections.entries()].filter(
    ([qid, val]) => (answerByQuestion.get(qid)?.answerValue ?? "") !== val,
  );
  if (realChanges.length === 0) {
    return err(
      appError("validation", "No cambiaste ninguna respuesta; corrige o completa al menos una para continuar."),
    );
  }

  // Corregir vs completar (actos clinicamente distintos, ver el enum). Si TODOS los cambios reales son
  // a preguntas SIN respuesta previa, es completar; si alguno toca una respuesta existente, es
  // correccion (hubo un fallo). recalibracion_ciencia no pasa por aqui (no es a nivel de respuesta).
  const allCompletions = realChanges.every(([qid]) => !answerByQuestion.has(qid));
  const effectiveTrigger: "correccion_profesional" | "completar_profesional" | "recalibracion_ciencia" =
    input.triggerType === "correccion_profesional" && allCompletions ? "completar_profesional" : input.triggerType;

  // Respuestas corregidas: para copiar (todas) y para el motor (solo las que llevan field_key).
  const correctedRows = answers.map((a) => ({
    questionId: a.questionId,
    answerValue: corrections.has(a.questionId) ? corrections.get(a.questionId)! : a.answerValue,
    fieldKey: a.fieldKey,
    type: a.type,
  }));
  // Completar: preguntas corregidas SIN fila previa -> filas NUEVAS (type/field_key del catalogo).
  // Solo con valor no vacio (una respuesta vacia no se inserta, igual que el intake no crea filas
  // vacias). Asi una pregunta con field_key completada llega al motor y mueve dfi.complete.
  for (const [qid, val] of corrections) {
    if (!answerByQuestion.has(qid) && val.trim() !== "") {
      const q = catalogByQuestion.get(qid)!; // garantizado por el gate de existencia de arriba
      correctedRows.push({ questionId: qid, answerValue: val, fieldKey: q.fieldKey, type: q.type });
    }
  }
  const engineAnswers: SurveyFieldAnswer[] = correctedRows
    .filter((r) => r.fieldKey)
    .map((r) => ({ fieldKey: r.fieldKey!, type: r.type, value: r.answerValue ?? "" }));

  // --- Compute (PURO + lecturas, fuera de la tx). El modelo NO se fija: es el frozen en disco, se
  // sella la version REAL (PLAN (b)). ---
  const model = await readActiveModel();
  if (!model) return err(appError("internal", "No hay una versión del modelo activa."));

  const engineInput = buildEngineInput(
    {
      sex: inputs.sex,
      birthDate: inputs.birthDate,
      surveyAnswers: engineAnswers,
      expectedFieldKeys: inputs.expectedFieldKeys,
      bisRaw: inputs.bisRaw,
    },
    { version: model.versionName, rulesVersion: model.rulesVersion },
    new Date(),
  );
  const output = runEngine(engineInput);

  // GATE de encuesta COMPLETA TAMBIEN al REGENERAR (Gildardo §1): si el profesional corrige y deja la
  // encuesta incompleta, no puede regenerar. Mismo predicado que al generar (las 64 de la version), pero
  // sobre el estado CORREGIDO (correctedRows), no el guardado: una pregunta completada en esta correccion
  // ya cuenta. El mensaje dice cuanto falta y por dominio.
  const correctedByQuestion = new Map(correctedRows.map((r) => [r.questionId, r.answerValue ?? null]));
  const surveyGaps = computeSurveyGaps(
    catalog.map((q) => ({
      section: q.section,
      orderIndex: q.orderIndex,
      answerValue: correctedByQuestion.get(q.id) ?? null,
    })),
  );
  if (surveyGaps.length > 0) {
    return err(appError("validation", formatIncompleteSurveyMessage(surveyGaps, "regenerar")));
  }

  let protocolSuggested: ProtocoloSnapshot | null = null;
  let protocolFailMotive: string | null = null;
  try {
    protocolSuggested = computeProtocolo(engineInput, output);
    if (!protocolSuggested) protocolFailMotive = "computeProtocolo devolvio null (peso/talla)";
  } catch (e) {
    protocolFailMotive = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, { tags: { area: "correction-protocol", evaluationId: input.evaluationId } });
  }

  const efrContent = await readEfrContent(model.id, output.efrPhenotype.bands);
  if (!efrContent) {
    return err(appError("internal", "El registry no tiene el contenido del estado EFR diagnosticado."));
  }
  const validityCaveats = await getSealedValidityCaveats(input.evaluationId);
  const rutasContent = resolveRutasContent(output.dfi.rutas);

  // Aviso condicional (PLAN (b)): el diagnostico viejo se emitio con una version del motor; si la de
  // hoy difiere, ademas del dato corregido pueden haber cambiado clasificaciones. Se detecta
  // comparando engine_version del diagnostico viejo con la que se va a sellar (la de hoy).
  const [oldDiag] = await db
    .select({ engineVersion: diagnoses.engineVersion })
    .from(diagnoses)
    .where(eq(diagnoses.evaluationId, input.evaluationId))
    .orderBy(desc(diagnoses.createdAt))
    .limit(1);
  const modelChanged = Boolean(oldDiag && oldDiag.engineVersion !== output.versions.engine);

  // Snapshot de las medicion + raw ORIGINALES para la verificacion exacta (Condicion 1).
  const [oldMeas] = await db
    .select({
      id: bisMeasurements.id,
      deviceId: bisMeasurements.deviceId,
      measurementDate: bisMeasurements.measurementDate,
      deviceCalibrationDate: bisMeasurements.deviceCalibrationDate,
    })
    .from(bisMeasurements)
    .where(eq(bisMeasurements.evaluationId, input.evaluationId))
    .orderBy(desc(bisMeasurements.measurementDate))
    .limit(1);
  if (!oldMeas) return err(appError("validation", "La evaluación no tiene una medición BIS."));
  const oldRaw = await db
    .select({ variableName: bisRawValues.variableName, value: bisRawValues.value })
    .from(bisRawValues)
    .where(eq(bisRawValues.measurementId, oldMeas.id));
  const rawFingerprint = (rows: { variableName: string; value: string }[]) =>
    rows
      .map((r) => `${r.variableName}=${r.value}`)
      .sort()
      .join("|");
  const oldFingerprint = rawFingerprint(oldRaw);

  // --- La transaccion atomica: copia + escritura del pipeline + correccion + audit. Todo o nada. ---
  try {
    const result = await db.transaction(async (tx) => {
      // (i) evaluacion nueva (misma constelacion de pertenencia)
      const [newEval] = await tx
        .insert(evaluations)
        .values({
          patientId: ev.patientId,
          professionalId: ev.professionalId,
          organizationId: ev.organizationId,
          type: ev.type,
          status: "in_progress",
          // Constancia: la correccion recomputa datos capturados bajo el consentimiento vigente; sella la
          // version actual (hoy todos en v1.0; cuando las versiones diverjan, revisar si debe copiar la del
          // original). El dato original se capturo bajo la misma o una version compatible.
          consentVersion: CONSENT_VERSION,
        })
        .returning({ id: evaluations.id });

      // (ii) copiar la medicion: measurement_date PRESERVADA (Condicion 2), id/created_at NUEVOS
      const [newMeas] = await tx
        .insert(bisMeasurements)
        .values({
          evaluationId: newEval.id,
          deviceId: oldMeas.deviceId,
          measurementDate: oldMeas.measurementDate,
          deviceCalibrationDate: oldMeas.deviceCalibrationDate,
        })
        .returning({ id: bisMeasurements.id });
      if (oldRaw.length) {
        await tx.insert(bisRawValues).values(
          oldRaw.map((r) => ({ measurementId: newMeas.id, variableName: r.variableName, value: r.value })),
        );
      }

      // Condicion 1: verificar EN TIEMPO DE EJECUCION que la copia es exacta; abortar si no.
      const [newMeasRead] = await tx
        .select({
          deviceId: bisMeasurements.deviceId,
          measurementDate: bisMeasurements.measurementDate,
          deviceCalibrationDate: bisMeasurements.deviceCalibrationDate,
        })
        .from(bisMeasurements)
        .where(eq(bisMeasurements.id, newMeas.id))
        .limit(1);
      const newRaw = await tx
        .select({ variableName: bisRawValues.variableName, value: bisRawValues.value })
        .from(bisRawValues)
        .where(eq(bisRawValues.measurementId, newMeas.id));
      const sameMeas =
        newMeasRead.deviceId === oldMeas.deviceId &&
        newMeasRead.measurementDate?.getTime() === oldMeas.measurementDate?.getTime() &&
        newMeasRead.deviceCalibrationDate === oldMeas.deviceCalibrationDate;
      if (!sameMeas || rawFingerprint(newRaw) !== oldFingerprint) {
        // Falla en voz alta: la copia difiere del origen (familia del bug de cintura). Rollback.
        throw new Error("Corrección abortada: la copia de la medición BIS no es identica al origen.");
      }

      // (iii) copiar la respuesta de encuesta CORREGIDA
      const [newResp] = await tx
        .insert(surveyResponses)
        .values({ evaluationId: newEval.id, surveyVersionId: inputs.surveyVersionId! })
        .returning({ id: surveyResponses.id });
      await tx.insert(surveyAnswers).values(
        correctedRows.map((r) => ({
          responseId: newResp.id,
          questionId: r.questionId,
          answerValue: r.answerValue,
        })),
      );

      // (iv) escribir el diagnostico/tratamiento/reporte de la NUEVA, DENTRO de esta tx (refactor
      // aditivo de writePipeline): si algo despues falla, tambien se revierte.
      const written = await writePipeline(
        {
          evaluationId: newEval.id,
          patientId: ev.patientId,
          evaluationType: ev.type,
          output,
          efrContent,
          validityCaveats,
          rutasContent,
          protocolSuggested,
          protocolFailMotive,
          surveyVersionId: inputs.surveyVersionId!,
          modelVersionId: model.id,
          indicatorDefIdByCode: model.indicatorDefIdByCode,
          phenotypeIdByKey: model.phenotypeIdByKey,
          frSectorIdByKey: model.frSectorIdByKey,
          actorId: actor.actorId,
          actorEmail: actor.actorEmail,
          ip: actor.ip,
        },
        tx,
      );

      // (v) la correccion: encadena old->new. El trigger apply marca la vieja superseded (dentro de
      // esta misma tx). El guard ya garantizo que la vieja era vigente.
      await tx.insert(clinicalCorrections).values({
        oldEvaluationId: input.evaluationId,
        newEvaluationId: newEval.id,
        correctedBy: actor.actorId,
        reason: input.reason.trim(),
        triggerType: effectiveTrigger,
      });

      // (vi) audit inline (regla 8)
      await recordAudit(tx, {
        event: "evaluation.corrected",
        actorId: actor.actorId,
        actorEmail: actor.actorEmail,
        entityType: "evaluation",
        entityId: newEval.id,
        payload: {
          old_evaluation_id: input.evaluationId,
          new_evaluation_id: newEval.id,
          reason: input.reason.trim(),
          trigger_type: effectiveTrigger,
          corrected_questions: input.correctedAnswers.map((c) => c.questionId),
          model_changed: modelChanged,
        },
        ip: actor.ip,
      });

      return { newEvaluationId: newEval.id, diagnosisId: written.diagnosisId };
    });

    return ok({
      oldEvaluationId: input.evaluationId,
      newEvaluationId: result.newEvaluationId,
      diagnosisId: result.diagnosisId,
      modelChanged,
    });
  } catch (e) {
    // Cualquier fallo (copia no exacta, pipeline, etc.) revirtio la tx entera: no quedo evaluacion
    // nueva, ni correccion, y la vieja sigue intacta y vigente. Se mapea a Result.
    const message = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, { tags: { area: "correct-evaluation", evaluationId: input.evaluationId } });
    return err(appError("internal", `La correccion no se pudo completar: ${message}`));
  }
}
