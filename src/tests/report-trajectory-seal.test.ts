import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq, inArray, sql } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue } from "./fixtures/clinical-engine/dfi-complete-answers";

// P0 Parte 2 (P3): verifica EJECUTANDO que la banda de EB-BIS se SELLA en el reporte de un seguimiento,
// por measurement_date (C2-a) y con el gate de 12 semanas, contra la BD local. Se AUTO-SALTA sin
// DATABASE_URL. El nucleo puro (bandas, intervalo) ya se prueba en eb-trajectory.test.ts; aqui se prueba
// el CABLEADO (que el pipeline-writer selle lo correcto).

vi.mock("server-only", () => ({}));

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

describe.skipIf(!HAS_DB)("sellado de la trayectoria de EB-BIS (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string;

  const createdEvals: string[] = [];
  const createdPatients: string[] = [];

  // Crea un paciente + una evaluacion diagnosticada con una measurement_date DADA, corriendo el
  // pipeline real (sella la EB). type = inicial | seguimiento. Devuelve el evaluationId.
  async function makeDiagnosed(suffix: string, type: string, measurementDate: string, patientId?: string) {
    let pid: string;
    if (patientId) {
      pid = patientId;
    } else {
      pid = (
        await db
          .insert(schema.patients)
          .values({ organizationId: orgId, documentType: "CC", documentNumber: `TRAJ-${suffix}-${Date.now()}` })
          .returning({ id: schema.patients.id })
      )[0].id;
      createdPatients.push(pid);
      await db.insert(schema.patientProfiles).values({ patientId: pid, firstName: "Traj", lastName: suffix, sex: "Male", birthDate: "1971-11-05" });
      await db.insert(schema.patientProfessionalRelationships).values({ patientId: pid, professionalId: proId }).onConflictDoNothing();
    }
    const evaluationId = (
      await db
        .insert(schema.evaluations)
        .values({ patientId: pid, professionalId: proId, organizationId: orgId, type, status: "in_progress" })
        .returning({ id: schema.evaluations.id })
    )[0].id;
    createdEvals.push(evaluationId);
    const respId = (
      await db.insert(schema.surveyResponses).values({ evaluationId, surveyVersionId: svId }).returning({ id: schema.surveyResponses.id })
    )[0].id;
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !(q.fieldKey in ANSWERS)) continue;
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const value = resolveAnswerValue(opts.map((o: { text: string }) => o.text), ANSWERS[q.fieldKey]);
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
    const measId = (
      await db.insert(schema.bisMeasurements).values({ evaluationId, measurementDate: new Date(measurementDate) }).returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "traj@cnv", ip: null });
    expect(res.ok).toBe(true);
    return { evaluationId, patientId: pid };
  }

  async function trajectoryOf(evaluationId: string) {
    return (
      await db.select({ t: schema.reports.trajectory }).from(schema.reports).where(eq(schema.reports.evaluationId, evaluationId)).limit(1)
    )[0].t;
  }

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline")).runClinicalPipeline;
    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    actorId = (
      await db.select({ profileId: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).where(eq(schema.professionalProfiles.id, proId)).limit(1)
    )[0].profileId;
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1))[0].id;
  });

  afterAll(async () => {
    if (!db || !createdEvals.length) return;
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
        await tx.delete(schema.followupMetrics).where(
          inArray(schema.followupMetrics.followupId, db.select({ id: schema.followups.id }).from(schema.followups).where(inArray(schema.followups.evaluationId, all))),
        );
        await tx.delete(schema.followups).where(inArray(schema.followups.evaluationId, all));
        await tx.delete(schema.treatments).where(inArray(schema.treatments.diagnosisId, diagIds));
        await tx.delete(schema.diagnoses).where(inArray(schema.diagnoses.id, diagIds));
      }
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, all));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, createdPatients));
    });
  });

  it("seguimiento con previa a >=12 semanas: sella la banda (mismo BIS -> sin_cambio) contra la previa", async () => {
    const prior = await makeDiagnosed("BAND", "inicial", "2026-04-01T10:00:00Z");
    // La INICIAL no tiene previa comparable: su trayectoria es null.
    expect(await trajectoryOf(prior.evaluationId)).toBeNull();

    // Seguimiento ~18 semanas despues, MISMO paciente y MISMO BIS -> EB igual -> delta 0 -> sin_cambio.
    const follow = await makeDiagnosed("BAND", "seguimiento", "2026-08-05T10:00:00Z", prior.patientId);
    const t = await trajectoryOf(follow.evaluationId);
    expect(t).toBeTruthy();
    expect(t.band).toBe("sin_cambio");
    expect(t.comparedToEvaluationId).toBe(prior.evaluationId); // ancla en la previa correcta
    expect(t.ebDelta).toBe(0); // mismo BIS
    expect(t.cutYears).toBe(2);
    expect(t.provisional).toBe(true);
    expect(t.intervalWeeks).toBeGreaterThanOrEqual(12);
  });

  it("seguimiento con previa a <12 semanas: NO sella banda (intervalo corto -> null)", async () => {
    const prior = await makeDiagnosed("SHORT", "inicial", "2026-08-01T10:00:00Z");
    const follow = await makeDiagnosed("SHORT", "seguimiento", "2026-08-15T10:00:00Z", prior.patientId); // ~2 semanas
    expect(await trajectoryOf(follow.evaluationId)).toBeNull();
  });
});
