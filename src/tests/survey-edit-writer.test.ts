import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq, inArray, sql } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
// Juego que deja dfi.complete=true: el gate de generacion (Gildardo 2026-08-13 §1) no sella incompletas.
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue, defaultAnswerFor } from "./fixtures/clinical-engine/dfi-complete-answers";
import {
  borrarPreguntaSinFieldKey,
  crearPreguntaSinFieldKey,
} from "./fixtures/pregunta-sin-field-key";

// (a) Edicion de la encuesta por el profesional ANTES del diagnostico. Verificacion contra la BD real
// (como correct-evaluation): el camino feliz + los guards que importan (asignacion, y sobre todo el de
// (b): si ya hay diagnostico, NO se edita directo -> already_diagnosed, hay que usar correccion). Se
// AUTO-SALTA sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  /* sin .env.local: el guard salta el bloque */
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const biody = biodyJson as Record<string, unknown>;
function bisRawRows(fixture: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number" && Number.isFinite(v)) rows.push({ name: normalizeHeader(k), value: String(v) });
  }
  return rows;
}

describe.skipIf(!HAS_DB)("saveSurveyEdit (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let saveSurveyEdit: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string, qId: string;

  const createdEvals: string[] = [];
  const createdPatients: string[] = [];

  async function makeDraftWithSurvey(suffix: string, status = "draft") {
    const patientId = (
      await db
        .insert(schema.patients)
        .values({ organizationId: orgId, documentType: "CC", documentNumber: `EDIT-${suffix}-${Date.now()}` })
        .returning({ id: schema.patients.id })
    )[0].id;
    createdPatients.push(patientId);
    await db.insert(schema.patientProfiles).values({ patientId, firstName: "Edit", lastName: suffix, sex: "M", birthDate: "1971-11-05" });
    await db.insert(schema.patientProfessionalRelationships).values({ patientId, professionalId: proId }).onConflictDoNothing();
    const evaluationId = (
      await db
        .insert(schema.evaluations)
        .values({ patientId, professionalId: proId, organizationId: orgId, type: "inicial", status })
        .returning({ id: schema.evaluations.id })
    )[0].id;
    createdEvals.push(evaluationId);
    const respId = (
      await db.insert(schema.surveyResponses).values({ evaluationId, surveyVersionId: svId }).returning({ id: schema.surveyResponses.id })
    )[0].id;
    await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: qId, answerValue: "original" });
    return evaluationId;
  }

  async function makeDiagnosed(suffix: string) {
    const evaluationId = await makeDraftWithSurvey(suffix, "in_progress");
    // Juego COMPLETO de field_key: sin esto el gate bloquea el sellado (Gildardo §1) y no habria
    // diagnostico que probar (el guard already_diagnosed no dispararia). Se agrega a la respuesta ya creada.
    const respId = (
      await db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(eq(schema.surveyResponses.evaluationId, evaluationId)).limit(1)
    )[0].id;
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey, type: schema.surveyQuestions.questionType })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    // TODAS las preguntas (gate de 64, Gildardo §1): las de field_key con su valor del fixture, el resto
    // con una respuesta valida por defecto (simula un intake completo).
    for (const q of questions as { id: string; fieldKey: string | null; type: string }[]) {
      if (q.id === qId) continue; // makeDraftWithSurvey ya la sembro como "original" (los tests de edicion la usan)
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const texts = opts.map((o: { text: string }) => o.text);
      const value =
        q.fieldKey && q.fieldKey in ANSWERS
          ? resolveAnswerValue(texts, ANSWERS[q.fieldKey])
          : defaultAnswerFor(q.type, texts);
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
    const measId = (
      await db.insert(schema.bisMeasurements).values({ evaluationId, measurementDate: new Date("2026-06-22T15:09:00Z") }).returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "edit@cnv", ip: null });
    expect(res.ok).toBe(true);
    return evaluationId;
  }

  const actor = () => ({ actorId, actorEmail: "edit@cnv", ip: null });

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    saveSurveyEdit = (await import("@/modules/evaluations/data/survey-edit-writer")).saveSurveyEdit;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline")).runClinicalPipeline;

    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    actorId = (
      await db.select({ profileId: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).where(eq(schema.professionalProfiles.id, proId)).limit(1)
    )[0].profileId;
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1))[0].id;
    qId = await crearPreguntaSinFieldKey(db, svId);
  });

  afterAll(async () => {
    if (!db) return;
    // La pregunta que creo este test se borra AQUI. Dejarla convertiria la encuesta en una version con
    // una pregunta de mas, y la numeracion continua que ve el paciente cambiaria para todos.
    if (qId) await borrarPreguntaSinFieldKey(db, qId);
    if (!createdEvals.length) return;
    const all = createdEvals;
    const diags = await db.select({ id: schema.diagnoses.id }).from(schema.diagnoses).where(inArray(schema.diagnoses.evaluationId, all));
    const diagIds = diags.map((d: { id: string }) => d.id);
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(schema.reports).where(inArray(schema.reports.evaluationId, all));
      await tx.delete(schema.indicatorValues).where(inArray(schema.indicatorValues.evaluationId, all));
      await tx.delete(schema.bisRawValues).where(
        inArray(schema.bisRawValues.measurementId, db.select({ id: schema.bisMeasurements.id }).from(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, all))),
      );
      await tx.delete(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, all));
      await tx.delete(schema.surveyAnswers).where(
        inArray(schema.surveyAnswers.responseId, db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, all))),
      );
      await tx.delete(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, all));
      if (diagIds.length) {
        await tx.delete(schema.treatments).where(inArray(schema.treatments.diagnosisId, diagIds));
        await tx.delete(schema.diagnoses).where(inArray(schema.diagnoses.id, diagIds));
      }
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, all));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, createdPatients));
    });
  });

  it("camino feliz: reemplaza el snapshot de respuestas y audita evaluation.survey_edited", async () => {
    const id = await makeDraftWithSurvey("HAPPY");
    const res = await saveSurveyEdit({ ...actor(), evaluationId: id, answers: [{ questionId: qId, answerValue: "CORREGIDO" }] });
    expect(res.ok).toBe(true);
    expect(res.answered).toBe(1);

    const resp = (await db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(eq(schema.surveyResponses.evaluationId, id)))[0];
    const ans = await db.select().from(schema.surveyAnswers).where(eq(schema.surveyAnswers.responseId, resp.id));
    expect(ans).toHaveLength(1);
    expect(ans[0].answerValue).toBe("CORREGIDO");

    const audit = await db.select().from(schema.clinicalAuditLog).where(eq(schema.clinicalAuditLog.entityId, id));
    expect(audit.some((a: any) => a.event === "evaluation.survey_edited")).toBe(true);
  });

  it("guard (b): si ya hay diagnostico, NO se edita directo -> already_diagnosed", async () => {
    const id = await makeDiagnosed("DIAG");
    const res = await saveSurveyEdit({ ...actor(), evaluationId: id, answers: [{ questionId: qId, answerValue: "X" }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("already_diagnosed");
    // La respuesta original NO se toco (sigue "original").
    const resp = (await db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(eq(schema.surveyResponses.evaluationId, id)))[0];
    const ans = await db.select().from(schema.surveyAnswers).where(eq(schema.surveyAnswers.responseId, resp.id));
    expect(ans[0].answerValue).toBe("original");
  });

  it("guard: profesional no asignado -> not_assigned", async () => {
    const id = await makeDraftWithSurvey("NOTMINE");
    const res = await saveSurveyEdit({ actorId: orgId, actorEmail: "x@x", ip: null, evaluationId: id, answers: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_assigned");
  });

  it("guard: estado no editable (abandoned) -> not_editable", async () => {
    const id = await makeDraftWithSurvey("ABANDONED", "abandoned");
    const res = await saveSurveyEdit({ ...actor(), evaluationId: id, answers: [{ questionId: qId, answerValue: "Y" }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_editable");
  });
});
