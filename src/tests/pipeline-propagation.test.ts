import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import { eq, inArray, sql } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
// Juego que deja dfi.complete=true: el gate de generacion (Gildardo 2026-08-13 §1) no sella incompletas.
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue, defaultAnswerFor } from "./fixtures/clinical-engine/dfi-complete-answers";
import { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine/version";
import {
  borrarPreguntaSinFieldKey,
  crearPreguntaSinFieldKey,
} from "./fixtures/pregunta-sin-field-key";

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
  asmi: number | null;
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
    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;
    // La pregunta sin field_key NO se responde aparte: el bucle de abajo responde TODAS las de la version,
    // y esta ahora vive en ella (la crea el fixture). Antes salia de otra version por accidente del
    // `limit(1)`, y por eso las dos inserciones no chocaban.
    // Juego COMPLETO de field_key: sin esto el gate bloquea el sellado (encuesta incompleta). El diagnostico
    // por la ruta BIS (fenotipo, indicadores, protocolo) es el mismo; ademas ahora dfi.complete=true.
    {
      const questions = await db
        .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey, type: schema.surveyQuestions.questionType })
        .from(schema.surveyQuestions)
        .where(eq(schema.surveyQuestions.surveyVersionId, svId));
      // TODAS las preguntas (gate de 64): field_key con su valor del fixture, el resto por defecto.
      for (const q of questions as { id: string; fieldKey: string | null; type: string }[]) {
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
    const treatment = (
      await db.select().from(schema.treatments).where(eq(schema.treatments.diagnosisId, diag.id))
    )[0];
    return { indicators, diag, snapshot: report.snapshot as Snapshot, treatment };
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
    // Pregunta SIN field_key (para el caso de correccion de un dato que no mueve el motor). Se CREA:
    // desde la migracion 0085 ninguna pregunta sembrada tiene field_key nulo, asi que buscarla devolvia
    // vacio y este beforeAll reventaba. Ver el fixture.
    qId = await crearPreguntaSinFieldKey(db, svId);
  });

  afterAll(async () => {
    if (!db) return;
    // La pregunta que creo este test se borra AQUI. Dejarla convertiria la encuesta en una version con
    // una pregunta de mas, y la numeracion continua que ve el paciente cambiaria para todos.
    if (qId) await borrarPreguntaSinFieldKey(db, qId);
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

    const { indicators, diag, snapshot, treatment } = await readPersisted(evaluationId);

    // T2 A3: el protocolo sugerido quedo SELLADO en el tratamiento (INSERT, write-once), poblado y
    // COHERENTE con lo que el orquestador produce en aislamiento (mismos valores que su golden para
    // este fixture male 89/180): F5, Cunningham gebAuto 2004, pesoCalculo 76.625.
    const proto = treatment.protocolSuggested;
    expect(proto).not.toBeNull();
    // Contra la CONSTANTE, no contra una copia de la cadena de hoy: lo que este test afirma es que el
    // protocolo SELLA su version, no cual es. Decidir cuando sube es trabajo de protocol-version-lock,
    // que hashea los artefactos. Es la tercera copia a mano de esta cadena que ponia un test en rojo por
    // la razon equivocada; las tres retiradas.
    expect(proto.protocolEngineVersion).toBe(PROTOCOL_ENGINE_VERSION);
    expect(proto.fenotipo.id).toBe("F5");
    expect(proto.calorico.formula).toBe("Cunningham");
    expect(proto.calorico.gebAuto).toBe(2004);
    expect(proto.pesoCalculo).toBeCloseTo(76.625, 3);

    // el diagnostico real de Juan Esteban (oro): N_N_N_A, estado 33 (numeracion de Gildardo).
    expect(snapshot.efrPhenotype.key).toBe("N_N_N_A");
    expect(diag.efrStateNumber).toBe(33);
    expect(diag.diagnosisName).toBe("Composición saludable con grasa alta → riesgo de progresión");
    // los FK del registry se resolvieron por clave (fenotipo estructural + sector FyR).
    expect(diag.phenotypeId).not.toBeNull();
    expect(diag.frSectorId).not.toBeNull();
    // con la encuesta completa (el gate exige completitud para sellar, Gildardo §1), el DFI queda completo.
    expect(snapshot.dfi.complete).toBe(true);

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
    // el conteo de null tambien coincide (persistido == snapshot, sea cual sea la encuesta).
    expect(indicators.filter((r: { value: string | null }) => r.value == null)).toHaveLength(
      snapVals.filter((v) => v == null).length,
    );

    // ASMI (masa muscular apendicular) SELLADO en el snapshot del diagnostico: el donante trae MMEM,
    // asi que es un numero (los motores medico/ejercicio la leen para sarcopenia; snapshots viejos = null).
    expect(typeof snapshot.asmi).toBe("number");

    // constelacion del motor real sellada en cada indicador.
    // Contra la CONSTANTE: lo que se afirma es que el diagnostico SELLA la version del motor, no cual es.
    // Los literales "anibise-1.0.0" de otros tests SI se quedan a mano, y la diferencia importa: alli el
    // literal representa una version VIEJA a proposito (probar el camino del documento desfasado).
    expect(snapshot.versions.engine).toBe(ENGINE_VERSION);
    expect(
      indicators.every(
        (r: { engineVersion: string; surveyVersionId: string; modelVersionId: string; rulesVersion: string }) =>
          r.engineVersion === ENGINE_VERSION && r.surveyVersionId && r.modelVersionId && r.rulesVersion,
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
    expect(a.diag.efrStateNumber).toBe(33);
    expect(b.diag.efrStateNumber).toBe(31);
    // los outputs difieren: si se hubieran mezclado, serian iguales.
    expect(a.snapshot.indicators).not.toEqual(b.snapshot.indicators);
    expect(a.diag.efrStateNumber).not.toBe(b.diag.efrStateNumber);
  });
});
