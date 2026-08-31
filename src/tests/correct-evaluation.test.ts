import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
// Juego de respuestas que deja dfi.complete = true (fuente unica, compartida con golden-path.seed).
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue, defaultAnswerFor } from "./fixtures/clinical-engine/dfi-complete-answers";
import {
  borrarPreguntaSinFieldKey,
  crearPreguntaSinFieldKey,
} from "./fixtures/pregunta-sin-field-key";

// Flujo de correccion S1: verificacion ejecutando contra la BD local seedada, como
// pipeline-propagation. Prueba las dos mitades (PLAN): el camino feliz completo, y cada gate
// rechazando lo que debe, mas el rollback si el pipeline falla a mitad (el escenario que motivo
// el refactor de writePipeline). Se AUTO-SALTA sin DATABASE_URL.

vi.mock("server-only", () => ({}));

// Inyeccion de fallo para el test de rollback: por defecto usa el writePipeline REAL; cuando
// failWrite=true, lo hace lanzar DENTRO de la transaccion del servicio para probar que revierte.
let failWrite = false;
vi.mock("@/modules/clinical-pipeline/data/pipeline-writer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/clinical-pipeline/data/pipeline-writer")>();
  return {
    ...actual,
    writePipeline: (...args: Parameters<typeof actual.writePipeline>) =>
      failWrite ? Promise.reject(new Error("fallo inyectado a mitad del pipeline")) : actual.writePipeline(...args),
  };
});

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
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

describe.skipIf(!HAS_DB)("flujo de correccion S1 (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let correctEvaluation: any;
  let orgId: string, proId: string, actorId: string, svId: string;
  let nonFieldQId: string;

  const createdEvals: string[] = [];
  const createdPatients: string[] = [];
  const createdSurveyVersions: string[] = [];

  async function makeEvaluationWithDiagnosis(suffix: string) {
    const patientId = (
      await db
        .insert(schema.patients)
        .values({ organizationId: orgId, documentType: "CC", documentNumber: `CORR-${suffix}-${Date.now()}` })
        .returning({ id: schema.patients.id })
    )[0].id;
    createdPatients.push(patientId);
    await db.insert(schema.patientProfiles).values({
      patientId,
      firstName: "Corr",
      lastName: suffix,
      sex: "M",
      birthDate: "1971-11-05",
    });
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId, professionalId: proId })
      .onConflictDoNothing();
    const evaluationId = (
      await db
        .insert(schema.evaluations)
        .values({ patientId, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
        .returning({ id: schema.evaluations.id })
    )[0].id;
    createdEvals.push(evaluationId);
    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;
    // Se responde una pregunta SIN field_key (no llega al motor): corregir ESA respuesta no cambia la
    // salida del motor (caso identico, seguro para S1), pero SI dispara la correccion (cambio real).
    await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: nonFieldQId, answerValue: "original" });
    // Y el juego COMPLETO de field_key: el diagnostico sale con dfi.complete=true y el gate deja sellar.
    await seedFieldKeyAnswers(respId);
    const measId = (
      await db
        .insert(schema.bisMeasurements)
        .values({ evaluationId, measurementDate: new Date("2026-06-22T15:09:00Z") })
        .returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values(
      bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })),
    );
    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "corr@cnv", ip: null });
    expect(res.ok).toBe(true);
    return evaluationId;
  }

  // Siembra el juego DFI-complete (todos los field_key del diagnostico) en una respuesta. Con esto la
  // encuesta queda COMPLETA (dfi.complete=true) y el gate de generacion (Gildardo §1) deja sellar. Antes
  // del gate, los tests sembraban encuestas incompletas y el pipeline las sellaba degradadas; ya no se
  // puede (ver el test del gate). Toda evaluacion que se corrige parte ahora de un diagnostico COMPLETO.
  async function seedFieldKeyAnswers(respId: string) {
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey, type: schema.surveyQuestions.questionType })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    // TODAS las preguntas (gate de 64, Gildardo §1): field_key con su valor del fixture, el resto por defecto.
    // EXCEPTO nonFieldQId: ya se sembro con "original" (L94) para el test de no-op. Re-insertarla aqui creaba
    // una SEGUNDA fila (survey_answers no tiene unique en response_id+question_id) y, como el guard lee sin
    // ORDER BY y deduplica con Map (gana la ultima en orden fisico), el valor efectivo quedaba indeterminado:
    // rompia "corregir a original == no-op" cuando el heap devolvia el default de ultimo (2026-08-22).
    for (const q of questions as { id: string; fieldKey: string | null; type: string }[]) {
      if (q.id === nonFieldQId) continue;
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
  }

  const baseInput = (evaluationId: string) => ({
    evaluationId,
    correctedAnswers: [{ questionId: nonFieldQId, answerValue: "CORREGIDO" }],
    reason: "dato mal digitado",
    triggerType: "correccion_profesional" as const,
    confirmed: true,
  });
  const actor = () => ({ actorId, actorEmail: "corr@cnv", ip: null });

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline")).runClinicalPipeline;
    correctEvaluation = (await import("@/modules/corrections/services/correct-evaluation")).correctEvaluation;

    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    // El actor debe ser el profile ligado a ESE professional_profile (el gate de asignacion compara
    // getProfessionalProfileIdByUser(actorId) == eval.professional_id).
    actorId = (
      await db
        .select({ profileId: schema.professionalProfiles.profileId })
        .from(schema.professionalProfiles)
        .where(eq(schema.professionalProfiles.id, proId))
        .limit(1)
    )[0].profileId;
    svId = (
      await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1)
    )[0].id;
    // Pregunta sin field_key DE LA VERSION ACTIVA (svId): con mas de una version publicada (v2+v3), un
    // limit(1) sin filtrar por version podia agarrar una pregunta de OTRA version y romper la validacion
    // de la correccion (que valida contra la version activa). Se escopa a svId.
    nonFieldQId = await crearPreguntaSinFieldKey(db, svId);
  });

  afterAll(async () => {
    if (!db) return;
    // La pregunta que creo este test se borra AQUI. Dejarla convertiria la encuesta en una version con
    // una pregunta de mas, y la numeracion continua que ve el paciente cambiaria para todos.
    if (nonFieldQId) await borrarPreguntaSinFieldKey(db, nonFieldQId);
    if (!createdEvals.length) return;
    const all = createdEvals;
    const diags = await db.select({ id: schema.diagnoses.id }).from(schema.diagnoses).where(inArray(schema.diagnoses.evaluationId, all));
    const diagIds = diags.map((d: { id: string }) => d.id);
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(schema.clinicalCorrections).where(inArray(schema.clinicalCorrections.oldEvaluationId, all));
      await tx.delete(schema.reports).where(inArray(schema.reports.evaluationId, all));
      await tx.delete(schema.indicatorValues).where(inArray(schema.indicatorValues.evaluationId, all));
      await tx.delete(schema.bisRawValues).where(
        inArray(
          schema.bisRawValues.measurementId,
          db.select({ id: schema.bisMeasurements.id }).from(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, all)),
        ),
      );
      await tx.delete(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, all));
      await tx.delete(schema.surveyAnswers).where(
        inArray(
          schema.surveyAnswers.responseId,
          db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, all)),
        ),
      );
      await tx.delete(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, all));
      if (diagIds.length) {
        await tx.delete(schema.treatments).where(inArray(schema.treatments.diagnosisId, diagIds));
        await tx.delete(schema.diagnoses).where(inArray(schema.diagnoses.id, diagIds));
      }
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, all));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, createdPatients));
      if (createdSurveyVersions.length) {
        await tx.delete(schema.surveyVersions).where(inArray(schema.surveyVersions.id, createdSurveyVersions));
      }
    });
  });

  it("camino feliz: crea la version nueva, reemplaza la vieja, copia insumos y recalcula", async () => {
    const oldId = await makeEvaluationWithDiagnosis("HAPPY");
    const res = await correctEvaluation(baseInput(oldId), actor());
    expect(res.ok).toBe(true);
    const newId = res.value.newEvaluationId;
    createdEvals.push(newId);

    // la vieja quedo reemplazada, la nueva vigente
    const evs = await db.select({ id: schema.evaluations.id, superseded: schema.evaluations.supersededAt }).from(schema.evaluations).where(inArray(schema.evaluations.id, [oldId, newId]));
    expect(evs.find((e: any) => e.id === oldId).superseded).not.toBeNull();
    expect(evs.find((e: any) => e.id === newId).superseded).toBeNull();

    // la correccion encadena old->new con su motivo
    const corr = (await db.select().from(schema.clinicalCorrections).where(eq(schema.clinicalCorrections.oldEvaluationId, oldId)))[0];
    expect(corr.newEvaluationId).toBe(newId);
    expect(corr.reason).toBe("dato mal digitado");
    // cambia una respuesta EXISTENTE -> se deriva correccion (hubo un fallo), no completar
    expect(corr.triggerType).toBe("correccion_profesional");

    // la nueva tiene su PROPIO diagnostico (recalculado, no copiado)
    const newDiag = (await db.select().from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, newId)))[0];
    expect(newDiag).toBeTruthy();
    expect(res.value.diagnosisId).toBe(newDiag.id);

    // insumos copiados: la medicion con measurement_date PRESERVADA, y las raw exactas
    const oldMeas = (await db.select().from(schema.bisMeasurements).where(eq(schema.bisMeasurements.evaluationId, oldId)))[0];
    const newMeas = (await db.select().from(schema.bisMeasurements).where(eq(schema.bisMeasurements.evaluationId, newId)))[0];
    expect(newMeas.measurementDate.getTime()).toBe(oldMeas.measurementDate.getTime());
    const cnt = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bisRawValues).where(eq(schema.bisRawValues.measurementId, newMeas.id));
    const cntOld = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bisRawValues).where(eq(schema.bisRawValues.measurementId, oldMeas.id));
    expect(cnt[0].n).toBe(cntOld[0].n);

    // la respuesta corregida se copio con el nuevo valor (buscada por su pregunta: la encuesta ahora es
    // completa, hay muchas respuestas, asi que se ubica la corregida por questionId, no la primera).
    const newResp = (await db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(eq(schema.surveyResponses.evaluationId, newId)))[0];
    const newAns = (
      await db
        .select()
        .from(schema.surveyAnswers)
        .where(and(eq(schema.surveyAnswers.responseId, newResp.id), eq(schema.surveyAnswers.questionId, nonFieldQId)))
    )[0];
    expect(newAns.answerValue).toBe("CORREGIDO");
  });

  // GATE de encuesta completa (Gildardo 2026-08-13 §1): reemplaza al viejo test "completar por
  // correccion". Ese flujo (generar incompleto y completar despues) YA NO EXISTE: el gate impide sellar
  // un diagnostico con encuesta incompleta, asi que nunca hay un diagnostico incompleto que completar.
  // La cobertura que importa ahora es que el pipeline BLOQUEE lo incompleto y no selle nada.
  it("gate: el pipeline con encuesta INCOMPLETA bloquea y no sella (Gildardo 2026-08-13 §1)", async () => {
    const patientId = (
      await db.insert(schema.patients).values({ organizationId: orgId, documentType: "CC", documentNumber: `GATE-${Date.now()}` }).returning({ id: schema.patients.id })
    )[0].id;
    createdPatients.push(patientId);
    await db.insert(schema.patientProfiles).values({ patientId, firstName: "Gate", lastName: "Incompleta", sex: "M", birthDate: "1971-11-05" });
    await db.insert(schema.patientProfessionalRelationships).values({ patientId, professionalId: proId }).onConflictDoNothing();
    const evaluationId = (
      await db.insert(schema.evaluations).values({ patientId, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" }).returning({ id: schema.evaluations.id })
    )[0].id;
    createdEvals.push(evaluationId);
    const respId = (
      await db.insert(schema.surveyResponses).values({ evaluationId, surveyVersionId: svId }).returning({ id: schema.surveyResponses.id })
    )[0].id;
    // Encuesta INCOMPLETA: solo una pregunta sin field_key; ningun field_key del diagnostico respondido.
    await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: nonFieldQId, answerValue: "algo" });
    const measId = (
      await db.insert(schema.bisMeasurements).values({ evaluationId, measurementDate: new Date("2026-06-22T15:09:00Z") }).returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));

    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "corr@cnv", ip: null });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("validation");
      expect(res.error.fields?.incompleteSurvey).toBeTruthy(); // marca para que la UI ofrezca completar
    }
    // Y NADA sellado: sin diagnostico, sin reporte.
    const diag = await db.select().from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, evaluationId));
    expect(diag).toHaveLength(0);
  });

  it("gate: sin confirmacion, sin motivo, no asignado", async () => {
    const oldId = await makeEvaluationWithDiagnosis("GATES");
    const noConfirm = await correctEvaluation({ ...baseInput(oldId), confirmed: false }, actor());
    expect(noConfirm.ok).toBe(false);
    expect(noConfirm.error.message).toContain("confirmación");

    const noReason = await correctEvaluation({ ...baseInput(oldId), reason: "  " }, actor());
    expect(noReason.ok).toBe(false);
    expect(noReason.error.message).toContain("motivo");

    const notAssigned = await correctEvaluation(baseInput(oldId), { actorId: orgId, actorEmail: "x@x", ip: null });
    expect(notAssigned.ok).toBe(false);
    expect(notAssigned.error.message).toContain("asignado");
  });

  it("gate: sin cambios reales (mismo valor) se rechaza, no genera version identica", async () => {
    const oldId = await makeEvaluationWithDiagnosis("NOOP");
    // La respuesta actual es "original"; corregir a "original" es no-op.
    const res = await correctEvaluation(
      { ...baseInput(oldId), correctedAnswers: [{ questionId: nonFieldQId, answerValue: "original" }] },
      actor(),
    );
    expect(res.ok).toBe(false);
    expect(res.error.message).toContain("No cambiaste ninguna respuesta");
  });

  it("gate: no se corrige una ya reemplazada (segundo intento sobre la vieja)", async () => {
    const oldId = await makeEvaluationWithDiagnosis("TWICE");
    const first = await correctEvaluation(baseInput(oldId), actor());
    expect(first.ok).toBe(true);
    createdEvals.push(first.value.newEvaluationId);
    const second = await correctEvaluation(baseInput(oldId), actor());
    expect(second.ok).toBe(false);
    expect(second.error.message).toContain("ya fue corregida");
  });

  it("gate: version de encuesta distinta a la vigente se rechaza con mensaje claro", async () => {
    const oldId = await makeEvaluationWithDiagnosis("SURVEYVER");
    // Publicar una version de encuesta MAS NUEVA para el mismo template: getActiveSurvey pasa a ella,
    // la evaluacion queda en la anterior -> el gate debe rechazar.
    const templateId = (await db.select({ templateId: schema.surveyVersions.templateId }).from(schema.surveyVersions).where(eq(schema.surveyVersions.id, svId)).limit(1))[0].templateId;
    const maxNum = (await db.select({ n: schema.surveyVersions.versionNumber }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.versionNumber)).limit(1))[0].n;
    const newSv = (
      await db
        .insert(schema.surveyVersions)
        .values({ templateId, versionNumber: maxNum + 1, publishedAt: new Date(Date.now() + 1000) })
        .returning({ id: schema.surveyVersions.id })
    )[0].id;
    createdSurveyVersions.push(newSv);
    const res = await correctEvaluation(baseInput(oldId), actor());
    expect(res.ok).toBe(false);
    expect(res.error.message).toContain("versión anterior del cuestionario");
    // limpiar la version extra ya (para no afectar otros tests del archivo que leen getActiveSurvey)
    await db.delete(schema.surveyVersions).where(eq(schema.surveyVersions.id, newSv));
    createdSurveyVersions.pop();
  });

  it("rollback: si el pipeline falla a mitad, revierte entero (vieja intacta, sin huerfana)", async () => {
    const oldId = await makeEvaluationWithDiagnosis("ROLLBACK");
    // Se cuentan SOLO las evaluaciones del paciente de este test (makeEvaluationWithDiagnosis crea uno
    // nuevo por llamada), no las globales: los archivos de test corren en paralelo contra la misma BD real
    // y otro puede crear una evaluacion de OTRO paciente dentro de esta ventana; un conteo global se hacia
    // flaky por eso (41 vs 40). Acotado al paciente, la asercion mide justo lo que prueba (no quedo huerfana).
    const patientId = (await db.select({ p: schema.evaluations.patientId }).from(schema.evaluations).where(eq(schema.evaluations.id, oldId)))[0].p;
    const evalsBefore = (await db.select({ id: schema.evaluations.id }).from(schema.evaluations).where(eq(schema.evaluations.patientId, patientId))).length;
    failWrite = true;
    const res = await correctEvaluation(baseInput(oldId), actor());
    failWrite = false;
    expect(res.ok).toBe(false);

    // la vieja sigue vigente e intacta
    const old = (await db.select({ superseded: schema.evaluations.supersededAt }).from(schema.evaluations).where(eq(schema.evaluations.id, oldId)))[0];
    expect(old.superseded).toBeNull();
    // no quedo correccion
    const corr = await db.select().from(schema.clinicalCorrections).where(eq(schema.clinicalCorrections.oldEvaluationId, oldId));
    expect(corr).toHaveLength(0);
    // no quedo evaluacion nueva para este paciente (mismo conteo que antes)
    const evalsAfter = (await db.select({ id: schema.evaluations.id }).from(schema.evaluations).where(eq(schema.evaluations.patientId, patientId))).length;
    expect(evalsAfter).toBe(evalsBefore);
  });
});
