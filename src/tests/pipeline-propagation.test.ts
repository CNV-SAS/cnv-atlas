import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import { eq, inArray, isNull, sql } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// Propagacion (B11 ST7): input REAL (fila anonimizada del Biody, guardada como la guarda
// B8: header normalizado -> valor) -> motor real -> persistencia -> relectura. Aserta
// IDENTIDAD (el dato no se pierde ni cambia al fluir), AISLAMIENTO (dos evaluaciones no
// se mezclan) y ademas es el smoke de la cadena B8 -> build-engine-input -> motor -> BD.
// La fuente de verdad de la salida es el snapshot inmutable del reporte.
//
// Corre contra la BD local seedada (model_version real + registry poblado). Se AUTO-SALTA
// sin DATABASE_URL (CI sin BD).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const biody = biodyJson as Record<string, unknown>;
const FM_HEADER = "Masa grasa bruta measurementDetails.VALEURCALCULEEEXPORT kg";

// Convierte una fila del Biody (headers exactos) a filas de bis_raw_values como las
// guarda B8: variable_name = normalizeHeader(header), value = numero. Solo numericos.
function bisRawRows(fixture: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      rows.push({ name: normalizeHeader(k), value: String(v) });
    }
  }
  return rows;
}

type Snapshot = {
  indicators: Record<string, number | null>;
  efrPhenotype: { key: string; stateNumber: number };
  dfi: { complete: boolean };
  versions: { engine: string };
};

describe.skipIf(!HAS_DB)("propagacion BIS real -> diagnostico (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string, qId: string;

  const created: { evaluationId: string; patientId: string }[] = [];

  async function makeEvaluation(docSuffix: string, fixture: Record<string, unknown>) {
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
      sex: "Male",
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
        .values({ evaluationId, measurementDate: new Date("2026-06-22T15:09:00Z") })
        .returning({ id: schema.bisMeasurements.id })
    )[0].id;
    await db.insert(schema.bisRawValues).values(
      bisRawRows(fixture).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })),
    );
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
    // Pregunta SIN field_key: su respuesta no llega al motor, asi el DFI corre degradado
    // (dfi.complete=false), que es lo que valida este test (propagacion por la ruta BIS).
    qId = (
      await db
        .select({ id: schema.surveyQuestions.id })
        .from(schema.surveyQuestions)
        .where(isNull(schema.surveyQuestions.fieldKey))
        .limit(1)
    )[0].id;
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
      await tx.delete(schema.bisRawValues).where(
        inArray(
          schema.bisRawValues.measurementId,
          db.select({ id: schema.bisMeasurements.id }).from(schema.bisMeasurements).where(inArray(schema.bisMeasurements.evaluationId, evalIds)),
        ),
      );
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

  it("persiste el diagnostico REAL sin perdida y con la constelacion sellada", async () => {
    const evaluationId = await makeEvaluation("A", biody);
    const res = await runClinicalPipeline({ evaluationId, actorId, actorEmail: "prop@cnv", ip: null });
    expect(res.ok).toBe(true);

    const { indicators, diag, snapshot } = await readPersisted(evaluationId);

    // el diagnostico real de Juan Esteban (oro): N_N_N_A, estado 42.
    expect(snapshot.efrPhenotype.key).toBe("N_N_N_A");
    expect(diag.efrStateNumber).toBe(42);
    expect(diag.diagnosisName).toBe("Composición saludable con grasa alta → riesgo de progresión");
    // los FK del registry se resolvieron por clave (fenotipo estructural + sector FyR).
    expect(diag.phenotypeId).not.toBeNull();
    expect(diag.frSectorId).not.toBeNull();
    // sin encuesta real, el DFI quedo marcado incompleto (no null silencioso).
    expect(snapshot.dfi.complete).toBe(false);

    // identidad sin perdida: 12 indicadores; los no-null persistidos == los del snapshot.
    expect(indicators).toHaveLength(12);
    const snapVals = Object.values(snapshot.indicators);
    const snapNonNull = snapVals.filter((v): v is number => v != null).sort((a, b) => a - b);
    const persistedNonNull = indicators
      .map((r: { value: string | null }) => r.value)
      .filter((v: string | null): v is string => v != null)
      .map(Number)
      .sort((a: number, b: number) => a - b);
    expect(persistedNonNull).toEqual(snapNonNull);
    // el conteo de null tambien coincide (EB/IAE null sin encuesta).
    expect(indicators.filter((r: { value: string | null }) => r.value == null)).toHaveLength(
      snapVals.filter((v) => v == null).length,
    );

    // constelacion del motor real sellada en cada indicador.
    expect(snapshot.versions.engine).toBe("anibise-1.0.0");
    expect(
      indicators.every(
        (r: { engineVersion: string; surveyVersionId: string; modelVersionId: string; rulesVersion: string }) =>
          r.engineVersion === "anibise-1.0.0" && r.surveyVersionId && r.modelVersionId && r.rulesVersion,
      ),
    ).toBe(true);
  });

  it("aisla: dos BIS distintos dan diagnosticos distintos, cada uno el suyo", async () => {
    // Variante con FM bajo -> FMI derivado Normal -> fenotipo N_N_N_N (estado 41).
    const bajoFM = { ...biody, [FM_HEADER]: 10 };
    const evalA = await makeEvaluation("ISOA", biody);
    const evalB = await makeEvaluation("ISOB", bajoFM);

    const [ra, rb] = await Promise.all([
      runClinicalPipeline({ evaluationId: evalA, actorId, actorEmail: "prop@cnv", ip: null }),
      runClinicalPipeline({ evaluationId: evalB, actorId, actorEmail: "prop@cnv", ip: null }),
    ]);
    expect(ra.ok && rb.ok).toBe(true);

    const a = await readPersisted(evalA);
    const b = await readPersisted(evalB);

    expect(a.snapshot.efrPhenotype.key).toBe("N_N_N_A");
    expect(b.snapshot.efrPhenotype.key).toBe("N_N_N_N");
    expect(a.diag.efrStateNumber).toBe(42);
    expect(b.diag.efrStateNumber).toBe(41);
    // los outputs difieren: si se hubieran mezclado, serian iguales.
    expect(a.snapshot.indicators).not.toEqual(b.snapshot.indicators);
    expect(a.diag.efrStateNumber).not.toBe(b.diag.efrStateNumber);
  });
});
