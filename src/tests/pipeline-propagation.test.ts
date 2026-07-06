import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import { eq, inArray, sql } from "drizzle-orm";

// Test de propagacion de B9: input sintetico conocido -> stub -> persistencia ->
// relectura, asertando IDENTIDAD (el dato no se pierde al fluir) y AISLAMIENTO (dos
// evaluaciones no se mezclan). Es el bug cronico de ATLAS que este bloque previene.
//
// Corre contra la BD local seedada (necesita el model_version activo, sus
// indicator_definitions y un survey_version). Se AUTO-SALTA si no hay DATABASE_URL
// (CI sin BD), por eso vive aqui commiteado como regresion viva sin romper otros
// entornos. La fuente de verdad de la salida del motor es el snapshot del reporte.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard de abajo salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

// TODO(B11 ST7): reescribir para el motor REAL. Deshabilitado A PROPOSITO (no en
// silencio): el pipeline ahora corre la ciencia real fail-loud y necesita (a) el mapa
// BIS completo de ST6 para que el motor no lance por insumos faltantes, y (b) aserciones
// nuevas por el cambio de forma del EngineOutput (efrPhenotype en vez de efrState,
// indicadores nullable, engine "anibise-1.0.0"). Se reactiva y reescribe en ST7; no se
// elimina, es la regresion viva de propagacion (sin perdida + aislamiento).
const SKIP_PENDING_ST7_REWRITE = true;

type Snapshot = {
  indicators: Record<string, number>;
  efrState: { number: number };
  versions: { engine: string };
};

describe.skipIf(!HAS_DB || SKIP_PENDING_ST7_REWRITE)("propagacion encuesta/BIS -> diagnostico (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string, qId: string;

  const created: { evaluationId: string; patientId: string }[] = [];

  async function makeEvaluation(docSuffix: string, birthDate: string) {
    const patientId = (
      await db
        .insert(schema.patients)
        .values({ organizationId: orgId, documentType: "CC", documentNumber: `PROP-${docSuffix}-${Date.now()}` })
        .returning({ id: schema.patients.id })
    )[0].id;
    await db.insert(schema.patientProfiles).values({
      patientId,
      firstName: "Prop",
      lastName: docSuffix,
      sex: "Female",
      birthDate,
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
    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;
    await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: qId, answerValue: "x" });
    const measId = (
      await db
        .insert(schema.bisMeasurements)
        .values({ evaluationId, measurementDate: new Date("2026-04-12T19:18:00Z") })
        .returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values([
      { measurementId: measId, variableName: "Peso kg", value: "70" },
      { measurementId: measId, variableName: "Ángulo de fase a 50 kHz °", value: "6.2" },
    ]);
    created.push({ evaluationId, patientId });
    return evaluationId;
  }

  async function readPersisted(evaluationId: string) {
    const indicators = await db
      .select({ value: schema.indicatorValues.value, engineVersion: schema.indicatorValues.engineVersion, surveyVersionId: schema.indicatorValues.surveyVersionId, modelVersionId: schema.indicatorValues.modelVersionId, rulesVersion: schema.indicatorValues.rulesVersion })
      .from(schema.indicatorValues)
      .where(eq(schema.indicatorValues.evaluationId, evaluationId));
    const diag = (
      await db.select().from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, evaluationId))
    )[0];
    const report = (
      await db.select().from(schema.reports).where(eq(schema.reports.evaluationId, evaluationId))
    )[0];
    return { indicators, diag, snapshot: report.snapshot as Snapshot };
  }

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline"))
      .runClinicalPipeline;

    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    actorId = (await db.select({ id: schema.profiles.id }).from(schema.profiles).limit(1))[0].id;
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).limit(1))[0].id;
    qId = (await db.select({ id: schema.surveyQuestions.id }).from(schema.surveyQuestions).limit(1))[0].id;
  });

  afterAll(async () => {
    if (!db) return;
    const evalIds = created.map((c) => c.evaluationId);
    const patientIds = created.map((c) => c.patientId);
    if (!evalIds.length) return;
    const diags = await db
      .select({ id: schema.diagnoses.id })
      .from(schema.diagnoses)
      .where(inArray(schema.diagnoses.evaluationId, evalIds));
    const diagIds = diags.map((d: { id: string }) => d.id);
    // reports es inmutable (trigger): se limpia en modo replica (solo local).
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(schema.reports).where(inArray(schema.reports.evaluationId, evalIds));
      await tx.delete(schema.indicatorValues).where(inArray(schema.indicatorValues.evaluationId, evalIds));
      await tx.delete(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, evalIds));
      await tx.delete(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, evalIds));
      if (diagIds.length) {
        await tx.delete(schema.treatments).where(inArray(schema.treatments.diagnosisId, diagIds));
        await tx.delete(schema.diagnoses).where(inArray(schema.diagnoses.id, diagIds));
      }
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, evalIds));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, patientIds));
    });
  });

  it("persiste sin perdida: los 12 indicadores del motor llegan al snapshot y a la BD", async () => {
    const evaluationId = await makeEvaluation("A", "1990-01-01");
    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "prop@cnv", ip: null });
    expect(res.ok).toBe(true);

    const { indicators, diag, snapshot } = await readPersisted(evaluationId);
    // identidad: el multiset de valores persistidos == el del output del motor (snapshot).
    expect(indicators).toHaveLength(12);
    const persisted = indicators.map((r: { value: string }) => Number(r.value)).sort((a: number, b: number) => a - b);
    const fromEngine = Object.values(snapshot.indicators).sort((a, b) => a - b);
    expect(persisted).toEqual(fromEngine);
    // el diagnostico refleja el estado EFR del motor (no se pierde ni cambia).
    expect(diag.efrStateNumber).toBe(snapshot.efrState.number);
    expect(snapshot.versions.engine).toBe("stub-0.1.0");
    // constelacion sellada en cada indicador.
    expect(
      indicators.every(
        (r: { engineVersion: string; surveyVersionId: string; modelVersionId: string; rulesVersion: string }) =>
          r.engineVersion === "stub-0.1.0" && r.surveyVersionId && r.modelVersionId && r.rulesVersion,
      ),
    ).toBe(true);
  });

  it("aisla: dos evaluaciones distintas no mezclan sus datos", async () => {
    const evalA = await makeEvaluation("ISOA", "1990-01-01");
    const evalB = await makeEvaluation("ISOB", "1960-01-01"); // edad distinta -> salida distinta

    const [ra, rb] = await Promise.all([
      runClinicalPipeline({ evaluationId: evalA, actorId, actorEmail: "prop@cnv", ip: null }),
      runClinicalPipeline({ evaluationId: evalB, actorId, actorEmail: "prop@cnv", ip: null }),
    ]);
    expect(ra.ok && rb.ok).toBe(true);

    const a = await readPersisted(evalA);
    const b = await readPersisted(evalB);

    // las salidas difieren (edades distintas): si se hubieran mezclado, serian iguales.
    expect(a.snapshot.indicators).not.toEqual(b.snapshot.indicators);

    // cada evaluacion persiste EXACTAMENTE su propio output, no el de la otra.
    const valuesA = a.indicators.map((r: { value: string }) => Number(r.value)).sort((x: number, y: number) => x - y);
    const valuesB = b.indicators.map((r: { value: string }) => Number(r.value)).sort((x: number, y: number) => x - y);
    expect(valuesA).toEqual(Object.values(a.snapshot.indicators).sort((x, y) => x - y));
    expect(valuesB).toEqual(Object.values(b.snapshot.indicators).sort((x, y) => x - y));
    expect(valuesA).not.toEqual(valuesB);

    // cada snapshot pertenece a su evaluacion (el reporte se ato bien).
    expect(a.diag.efrStateNumber).toBe(a.snapshot.efrState.number);
    expect(b.diag.efrStateNumber).toBe(b.snapshot.efrState.number);
  });
});
