import ExcelJS from "exceljs";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } from "@/modules/consent/consent-hash";
import { NECESSARY_CONSENT_TYPES } from "@/modules/consent/validations";
import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

// Valores BIS REALES anonimizados (el mismo gold de los golden tests): fisiologicamente
// validos, con las rarezas del export real ("Género" = "Male", antropometricos null). El
// fixture biody_synthetic.xlsx NO sirve aqui: sus valores son placeholder (fuera de rango
// del motor), solo prueban el IMPORT de B8, no el motor. Ver src/tests/fixtures/README.md.
import biodyGold from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
// BIS femenino real (ZM3 anonimizado): primer caso que ejercita la mitad SEXO-ESPECIFICA del motor
// por el PIPELINE (no solo por unit test). Ver src/tests/fixtures/README.md.
import biodyFemale from "./fixtures/clinical-engine/biody-mujer-zm3-anon.json";
// Juego de respuestas que deja dfi.complete = true (fuente unica, compartida con el test de correccion).
import { DFI_COMPLETE_ANSWERS as ANSWERS } from "./fixtures/clinical-engine/dfi-complete-answers";

// SEED del caso golden-path por la VIA REAL (bloque prerrequisito "profesional primero").
// No es un test de aserciones: es una rutina de sembrado idempotente y RESUMIBLE que corre
// bajo el runner de vitest porque el motor y el pipeline son server-only y node no resuelve
// sus imports (por eso el seed normal no puede hacerlo). Ejecuta encuesta -> BIS -> motor ->
// diagnostico -> reporte por los servicios reales y persiste snapshots genuinos.
//
// CONFIRMACION 1 (mock): se mockea "server-only" para poder importar los modulos server-only
// reales (pipeline, bis) bajo vitest; el resto corre por la via real, sin fabricar nada.
vi.mock("server-only", () => ({}));

// Requiere BD local seedada (pnpm db:seed) y el flag explicito, para no correr en la suite.
// Se lanza con: pnpm seed:golden.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
const RUN = Boolean(process.env.DATABASE_URL) && process.env.SEED_GOLDEN === "1";

// IDs fijos: la idempotencia (y la resumibilidad) se apoyan en poder reconocer lo ya hecho.
const PATIENT_ID = "a0000000-0000-4000-8000-0000000000a1";
const EVAL_ID = "a0000000-0000-4000-8000-0000000000a2";
// Segunda evaluacion del MISMO paciente demo, SIN diagnostico (in_progress, encuesta parcial, sin
// BIS): caso de prueba de la pestana Evaluacion, rama sin diagnostico (el uso principal: revisar la
// entrada antes de generar). Es de tipo SEGUIMIENTO, como la resolveria el flujo real por documento
// (resolveIdentity: match de documento -> seguimiento); no dos "inicial" para el mismo paciente.
// URL: /evaluaciones/a0000000-0000-4000-8000-0000000000a3
const EVAL_ID_NODIAG = "a0000000-0000-4000-8000-0000000000a3";
// Paciente MUJER demo + evaluacion inicial in_progress SIN BIS: para el smoke del bloque femenino de
// la captura BIS (embarazo/menstruacion/semana del ciclo) y del flujo de import limpio (aun sin
// medicion). URL: /evaluaciones/a0000000-0000-4000-8000-0000000000c2
const FEMALE_PATIENT_ID = "a0000000-0000-4000-8000-0000000000c1";
const FEMALE_EVAL_ID = "a0000000-0000-4000-8000-0000000000c2";
const FEMALE_DOC = "GOLDEN-FEM-01";
const FEMALE_BIRTH = "1990-03-08";
// Segunda mujer demo, LIMPIA para el smoke de A/B/C desde cero: inicial in_progress, SIN condiciones
// guardadas, SIN BIS, SIN diagnostico. URL: /evaluaciones/a0000000-0000-4000-8000-0000000000c4
const FEMALE2_PATIENT_ID = "a0000000-0000-4000-8000-0000000000c3";
const FEMALE2_EVAL_ID = "a0000000-0000-4000-8000-0000000000c4";
const FEMALE2_DOC = "GOLDEN-FEM-02";
const FEMALE2_BIRTH = "1992-05-20";
// Mujer COMPLETA con BIS ZM3 real + diagnostico: el primer caso femenino que corre por el PIPELINE
// (ejercita los clasificadores sexo-especificos). Reusa la paciente c1. URL: /evaluaciones/...-c5
const FEMALE_COMPLETE_EVAL_ID = "a0000000-0000-4000-8000-0000000000c5";
const DOC_NUMBER = "GOLDEN-0001";
// DOB del donante real del BIS gold (~54 años): la edad alimenta EB-BIS/IAE, asi que debe
// ser la suya para que el envejecimiento biologico lea coherente con su medicion.
const BIRTH_DATE = "1971-11-05";
const SEX = "Male"; // se conserva en ingles como el export real (borde de normalizacion)
// Nombre de demo OBVIO: nadie debe confundirlo con un paciente real.
const FIRST_NAME = "Demo";
const LAST_NAME = "GoldenPath (motor real)";
// Correo de TODOS los pacientes demo: el buzon de pruebas de Santiago, para que el envio de reporte
// quede ejercitable de punta a punta con un destino real que el controla.
const PATIENT_EMAIL = "sau.idk001@gmail.com";
// IDs fijos de las notas del profesional. Demo GoldenPath es tambien el target del smoke de
// auditoria (Nivel b/c): tiene notas reales en las 3 tablas narrativas. Reemplaza la cadena
// demo fabricada a mano (99999999), retirada del node seed.
const EVAL_NOTE_ID = "a0000000-0000-4000-8000-0000000000b1";
const DIAG_NOTE_ID = "a0000000-0000-4000-8000-0000000000b2";
const TREAT_NOTE_ID = "a0000000-0000-4000-8000-0000000000b3";

// Construye en memoria el XLSX que consume el import BIS real, desde el gold JSON: hoja
// "Measures" (la que exige el parser), fila 1 = headers exactos, fila 2 = valores reales.
async function buildXlsx(gold: Record<string, unknown>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Measures");
  const keys = Object.keys(gold);
  ws.addRow(keys);
  ws.addRow(keys.map((k) => (gold[k] ?? null) as ExcelJS.CellValue));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe.skipIf(!RUN)("seed golden-path (via real pipeline)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let importBisMeasurement: any;
  let runClinicalPipeline: any;

  let orgId: string;
  let proId: string; // professional_profiles.id
  let actorId: string; // profiles.id (para audit + createdBy)
  let actorEmail: string;
  let svId: string; // survey_version activa
  let xlsx: ArrayBuffer; // XLSX del gold masculino, construido desde el JSON
  let femaleXlsx: ArrayBuffer; // XLSX del BIS femenino real (ZM3), para el caso femenino completo

  beforeAll(async () => {
    xlsx = await buildXlsx(biodyGold as Record<string, unknown>);
    femaleXlsx = await buildXlsx(biodyFemale as Record<string, unknown>);
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    importBisMeasurement = (await import("@/modules/bis/services/bis-import"))
      .importBisMeasurement;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline"))
      .runClinicalPipeline;

    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0]?.id;
    const pro = (
      await db
        .select({ id: schema.professionalProfiles.id, profileId: schema.professionalProfiles.profileId })
        .from(schema.professionalProfiles)
        .limit(1)
    )[0];
    proId = pro?.id;
    actorId = pro?.profileId;
    actorEmail = (
      await db.select({ email: schema.profiles.email }).from(schema.profiles).where(eq(schema.profiles.id, actorId)).limit(1)
    )[0]?.email;
    svId = (
      await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).limit(1)
    )[0]?.id;

    const model = (
      await db.select({ id: schema.modelVersions.id }).from(schema.modelVersions).where(eq(schema.modelVersions.status, "active")).limit(1)
    )[0];
    if (!orgId || !proId || !svId || !model) {
      throw new Error("Falta el seed base. Corre `pnpm db:seed` antes de `pnpm seed:golden`.");
    }
  });

  it("paciente, relacion y 3 consentimientos vigentes (idempotente)", async () => {
    await db
      .insert(schema.patients)
      .values({ id: PATIENT_ID, organizationId: orgId, documentType: "CC", documentNumber: DOC_NUMBER })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfiles)
      .values({ patientId: PATIENT_ID, firstName: FIRST_NAME, lastName: LAST_NAME, sex: SEX, birthDate: BIRTH_DATE, city: "Medellin" })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId: PATIENT_ID, professionalId: proId })
      .onConflictDoNothing();
    // Contacto del paciente: correo demo para ejercitar el envio de reporte de punta a punta.
    await db
      .insert(schema.patientContacts)
      .values({ patientId: PATIENT_ID, email: PATIENT_EMAIL })
      .onConflictDoNothing();

    // Los 3 consentimientos NECESARIOS vigentes, con la version y el hash reales del texto
    // vendorizado (regla C1), para que el gate pase de forma natural (no fabricado).
    for (const t of NECESSARY_CONSENT_TYPES) {
      const existing = await db
        .select({ id: schema.patientConsents.id })
        .from(schema.patientConsents)
        .where(
          and(
            eq(schema.patientConsents.patientId, PATIENT_ID),
            eq(schema.patientConsents.consentType, t),
            isNull(schema.patientConsents.revokedAt),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.patientConsents).values({
          patientId: PATIENT_ID,
          consentType: t,
          consentVersion: CONSENT_VERSION,
          documentHash: CONSENT_DOCUMENT_HASH,
        });
      }
    }

    const active = await db
      .select({ type: schema.patientConsents.consentType })
      .from(schema.patientConsents)
      .where(and(eq(schema.patientConsents.patientId, PATIENT_ID), isNull(schema.patientConsents.revokedAt)));
    const types = active.map((r: { type: string }) => r.type);
    for (const t of NECESSARY_CONSENT_TYPES) expect(types).toContain(t);
  });

  it("CONFIRMACION 2: el gate real (canCreateEvaluation) autoriza y solo entonces crea la evaluacion", async () => {
    // El gate importado es el REAL (unico hogar de la regla 15), no un stub: se comporta como
    // la regla. Evidencia de que esta en vigor: sin las 3, rehusa; con las 3, autoriza.
    expect(canCreateEvaluation(["servicio", "datos_sensibles"]).ok).toBe(false);

    const active = await db
      .select({ type: schema.patientConsents.consentType })
      .from(schema.patientConsents)
      .where(and(eq(schema.patientConsents.patientId, PATIENT_ID), isNull(schema.patientConsents.revokedAt)));
    const gate = canCreateEvaluation(active.map((r: { type: string }) => r.type));
    expect(gate.ok).toBe(true); // se EJERCE, no se saltea: sin ok no se inserta la evaluacion
    if (!gate.ok) throw new Error("gate de consentimiento no autorizado: no se crea la evaluacion");

    await db
      .insert(schema.evaluations)
      .values({ id: EVAL_ID, patientId: PATIENT_ID, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
      .onConflictDoNothing();
  });

  it("encuesta con field_key para DFI completo (idempotente)", async () => {
    const existing = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, EVAL_ID))
      .limit(1);
    if (existing.length > 0) return; // ya sembrada; resumible

    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId: EVAL_ID, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;

    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));

    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !(q.fieldKey in ANSWERS)) continue;
      const pick = ANSWERS[q.fieldKey];
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const texts = opts.map((o: { text: string }) => o.text);
      const chosen = pick.text ?? texts[pick.idx ?? 0];
      if (!texts.includes(chosen)) {
        throw new Error(`opcion no encontrada para ${q.fieldKey}: ${chosen}`);
      }
      const value = pick.multi ? JSON.stringify([chosen]) : chosen;
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
  });

  it("importa BIS real (valores gold, via import real) (idempotente)", async () => {
    const res = await importBisMeasurement({
      buffer: xlsx,
      evaluationId: EVAL_ID,
      deviceId: null,
      actorId,
      actorEmail,
      ip: null,
    });
    // Reimport = conflicto (ya importado): resumible, no es fallo.
    if (!res.ok && res.error?.code !== "conflict") {
      throw new Error(`import BIS fallo: ${res.error?.message}`);
    }
    const meas = await db
      .select({ id: schema.bisMeasurements.id })
      .from(schema.bisMeasurements)
      .where(eq(schema.bisMeasurements.evaluationId, EVAL_ID))
      .limit(1);
    expect(meas.length).toBe(1);
  });

  it("pipeline real: diagnostico + reporte con snapshot genuino (idempotente)", async () => {
    const res = await runClinicalPipeline({ evaluationId: EVAL_ID, actorId, actorEmail, ip: null });
    // Re-propagar = conflicto (ya hay diagnostico): resumible.
    if (!res.ok && res.error?.code !== "conflict") {
      throw new Error(`pipeline fallo: ${res.error?.message}`);
    }

    const diag = (
      await db.select().from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, EVAL_ID))
    )[0];
    expect(diag).toBeTruthy();
    expect(diag.engineVersion).toBe("anibise-1.0.0");

    const report = (
      await db.select().from(schema.reports).where(eq(schema.reports.evaluationId, EVAL_ID))
    )[0];
    expect(report).toBeTruthy();
    const snap = report.snapshot as {
      efrPhenotype?: { key?: string; stateNumber?: number };
      dfi?: { complete?: boolean; veto?: boolean };
      versions?: { engine?: string };
      efrContent?: { mechanism?: string | null; risks?: string | null };
    };
    // Snapshot GENUINO del motor real (no fabricado a mano): forma actual + version real.
    expect(snap.efrPhenotype).toBeTruthy();
    expect(snap.versions?.engine).toBe("anibise-1.0.0");
    // AUTOSUFICIENTE (ii): el contenido clinico del estado EFR quedo congelado en el snapshot,
    // asi la vista de resultados no re-deriva evidencia del registry vivo.
    expect(snap.efrContent?.mechanism).toBeTruthy();
    expect(snap.efrContent?.risks).toBeTruthy();
    // Coherencia con el BIS real: el gold de Juan Esteban clasifica N_N_N_A (composicion
    // saludable con grasa alta), estado 33 en la numeracion de Gildardo. El EFR depende solo
    // del BIS, asi que esto ancla que el diagnostico lee coherente con la medicion.
    expect(snap.efrPhenotype?.key).toBe("N_N_N_A");
    expect(snap.efrPhenotype?.stateNumber).toBe(33);
    // La encuesta cablea el DFI con el perfil documentado (sobrepeso leve, sedentario
    // moderado, 1 antecedente familiar, sin TCA) -> DFI completo, sin veto. Coherente con el
    // BIS: cuerpo con grasa alta + habitos moderados = riesgo integrado MEDIO.
    expect(snap.dfi?.complete).toBe(true);
    expect(snap.dfi?.veto).toBe(false);
  });

  it("notas del profesional en las 3 tablas narrativas (smoke de auditoria) (idempotente)", async () => {
    // Demo GoldenPath hospeda el smoke de auditoria (Nivel b/c): notas reales colgadas de la
    // evaluacion, el diagnostico y el tratamiento del caso. Idempotente por IDs fijos.
    const diag = (
      await db.select({ id: schema.diagnoses.id }).from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, EVAL_ID)).limit(1)
    )[0];
    const treat = (
      await db.select({ id: schema.treatments.id }).from(schema.treatments).where(eq(schema.treatments.diagnosisId, diag.id)).limit(1)
    )[0];
    expect(diag).toBeTruthy();
    expect(treat).toBeTruthy();

    await db
      .insert(schema.evaluationNotes)
      .values({ id: EVAL_NOTE_ID, evaluationId: EVAL_ID, authorId: actorId, note: "Nota de evaluacion (demo, smoke de auditoria)." })
      .onConflictDoNothing();
    await db
      .insert(schema.diagnosisNotes)
      .values({ id: DIAG_NOTE_ID, diagnosisId: diag.id, note: "Nota de diagnostico (demo, smoke de auditoria)." })
      .onConflictDoNothing();
    await db
      .insert(schema.treatmentNotes)
      .values({ id: TREAT_NOTE_ID, treatmentId: treat.id, note: "Nota de tratamiento (demo, smoke de auditoria)." })
      .onConflictDoNothing();
  });

  it("evaluacion demo SIN diagnostico (encuesta parcial, sin BIS) para el smoke de la pestana Evaluacion (idempotente)", async () => {
    // Segunda evaluacion del mismo paciente, in_progress (identidad ya confirmada) y SIN pipeline:
    // getEvaluationResults devuelve null -> rama sin diagnostico. Encuesta PARCIAL (solo 3 preguntas
    // respondidas) y sin medicion BIS: prueba que la vista de lectura muestra "sin responder" y la
    // composicion su estado vacio, sin tronar.
    await db
      .insert(schema.evaluations)
      .values({ id: EVAL_ID_NODIAG, patientId: PATIENT_ID, professionalId: proId, organizationId: orgId, type: "seguimiento", status: "in_progress" })
      .onConflictDoNothing();

    const existing = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, EVAL_ID_NODIAG))
      .limit(1);
    if (existing.length > 0) return; // ya sembrada; resumible

    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId: EVAL_ID_NODIAG, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;

    // Solo estas 3 se responden; el resto de la encuesta queda sin responder a proposito.
    const PARTIAL = ["d2_19", "d3_23", "d3_24"];
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !PARTIAL.includes(q.fieldKey)) continue;
      const pick = ANSWERS[q.fieldKey];
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const texts = opts.map((o: { text: string }) => o.text);
      const chosen = pick.text ?? texts[pick.idx ?? 0];
      const value = pick.multi ? JSON.stringify([chosen]) : chosen;
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
  });

  it("paciente MUJER demo, inicial in_progress SIN BIS, para el bloque femenino e import limpio (idempotente)", async () => {
    // Paciente distinto (mujer) con UNA sola evaluacion inicial: flujo de import LIMPIO (aun sin BIS,
    // el formulario aparece tras guardar condiciones) y el bloque femenino de la captura BIS
    // (embarazo con reconocimiento del comite de etica, menstruacion, semana del ciclo). Sin BIS.
    await db
      .insert(schema.patients)
      .values({ id: FEMALE_PATIENT_ID, organizationId: orgId, documentType: "CC", documentNumber: FEMALE_DOC })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfiles)
      .values({ patientId: FEMALE_PATIENT_ID, firstName: "Demo", lastName: "Mujer (bloque femenino)", sex: "Female", birthDate: FEMALE_BIRTH, city: "Medellin" })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId: FEMALE_PATIENT_ID, professionalId: proId })
      .onConflictDoNothing();
    await db
      .insert(schema.patientContacts)
      .values({ patientId: FEMALE_PATIENT_ID, email: "sau.idk001@gmail.com" })
      .onConflictDoNothing();
    for (const t of NECESSARY_CONSENT_TYPES) {
      const existing = await db
        .select({ id: schema.patientConsents.id })
        .from(schema.patientConsents)
        .where(
          and(
            eq(schema.patientConsents.patientId, FEMALE_PATIENT_ID),
            eq(schema.patientConsents.consentType, t),
            isNull(schema.patientConsents.revokedAt),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.patientConsents).values({
          patientId: FEMALE_PATIENT_ID,
          consentType: t,
          consentVersion: CONSENT_VERSION,
          documentHash: CONSENT_DOCUMENT_HASH,
        });
      }
    }
    await db
      .insert(schema.evaluations)
      .values({ id: FEMALE_EVAL_ID, patientId: FEMALE_PATIENT_ID, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
      .onConflictDoNothing();

    const existing = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, FEMALE_EVAL_ID))
      .limit(1);
    if (existing.length > 0) return; // ya sembrada; resumible
    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId: FEMALE_EVAL_ID, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;
    const PARTIAL = ["d2_19", "d3_23", "d3_24"];
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !PARTIAL.includes(q.fieldKey)) continue;
      const pick = ANSWERS[q.fieldKey];
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const texts = opts.map((o: { text: string }) => o.text);
      const chosen = pick.text ?? texts[pick.idx ?? 0];
      const value = pick.multi ? JSON.stringify([chosen]) : chosen;
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
  });

  it("segunda mujer demo LIMPIA (sin condiciones, sin BIS, sin diagnostico) para el smoke A/B/C desde cero (idempotente)", async () => {
    // Nueva paciente + evaluacion inicial in_progress, VIRGEN: sin captura de condiciones, sin BIS,
    // sin diagnostico. Sirve para probar A (obligatoriedad), B (import que se habilita al guardar
    // condiciones + exito persistente) y luego C (llevarla end-to-end hasta diagnostico y ver la
    // lectura sellada). Distinta de c2, que ya quedo diagnosticada.
    await db
      .insert(schema.patients)
      .values({ id: FEMALE2_PATIENT_ID, organizationId: orgId, documentType: "CC", documentNumber: FEMALE2_DOC })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfiles)
      .values({ patientId: FEMALE2_PATIENT_ID, firstName: "Demo", lastName: "Mujer 2 (smoke A/B/C)", sex: "Female", birthDate: FEMALE2_BIRTH, city: "Medellin" })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId: FEMALE2_PATIENT_ID, professionalId: proId })
      .onConflictDoNothing();
    await db
      .insert(schema.patientContacts)
      .values({ patientId: FEMALE2_PATIENT_ID, email: "sau.idk001@gmail.com" })
      .onConflictDoNothing();
    for (const t of NECESSARY_CONSENT_TYPES) {
      const existing = await db
        .select({ id: schema.patientConsents.id })
        .from(schema.patientConsents)
        .where(
          and(
            eq(schema.patientConsents.patientId, FEMALE2_PATIENT_ID),
            eq(schema.patientConsents.consentType, t),
            isNull(schema.patientConsents.revokedAt),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.patientConsents).values({
          patientId: FEMALE2_PATIENT_ID,
          consentType: t,
          consentVersion: CONSENT_VERSION,
          documentHash: CONSENT_DOCUMENT_HASH,
        });
      }
    }
    await db
      .insert(schema.evaluations)
      .values({ id: FEMALE2_EVAL_ID, patientId: FEMALE2_PATIENT_ID, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
      .onConflictDoNothing();

    const existing = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, FEMALE2_EVAL_ID))
      .limit(1);
    if (existing.length > 0) return; // ya sembrada; resumible
    const respId = (
      await db
        .insert(schema.surveyResponses)
        .values({ evaluationId: FEMALE2_EVAL_ID, surveyVersionId: svId })
        .returning({ id: schema.surveyResponses.id })
    )[0].id;
    const PARTIAL = ["d2_19", "d3_23", "d3_24"];
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !PARTIAL.includes(q.fieldKey)) continue;
      const pick = ANSWERS[q.fieldKey];
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      const texts = opts.map((o: { text: string }) => o.text);
      const chosen = pick.text ?? texts[pick.idx ?? 0];
      const value = pick.multi ? JSON.stringify([chosen]) : chosen;
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
  });

  it("mujer demo COMPLETA con BIS ZM3 real: primer caso femenino que corre por el PIPELINE (idempotente)", async () => {
    // Reusa la paciente c1 (ya tiene los 3 consentimientos, sembrados arriba) con una evaluacion
    // NUEVA que llega a diagnostico. Encuesta COMPLETA (mismo juego DFI) + BIS femenino real (ZM3):
    // ejercita por primera vez la mitad sexo-especifica del motor de punta a punta, no solo por unit test.
    await db
      .insert(schema.evaluations)
      .values({ id: FEMALE_COMPLETE_EVAL_ID, patientId: FEMALE_PATIENT_ID, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
      .onConflictDoNothing();

    const hasResp = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, FEMALE_COMPLETE_EVAL_ID))
      .limit(1);
    if (hasResp.length === 0) {
      const respId = (
        await db
          .insert(schema.surveyResponses)
          .values({ evaluationId: FEMALE_COMPLETE_EVAL_ID, surveyVersionId: svId })
          .returning({ id: schema.surveyResponses.id })
      )[0].id;
      const questions = await db
        .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
        .from(schema.surveyQuestions)
        .where(eq(schema.surveyQuestions.surveyVersionId, svId));
      for (const q of questions as { id: string; fieldKey: string | null }[]) {
        if (!q.fieldKey || !(q.fieldKey in ANSWERS)) continue;
        const pick = ANSWERS[q.fieldKey];
        const opts = await db
          .select({ text: schema.surveyOptions.optionText })
          .from(schema.surveyOptions)
          .where(eq(schema.surveyOptions.questionId, q.id))
          .orderBy(schema.surveyOptions.orderIndex);
        const texts = opts.map((o: { text: string }) => o.text);
        const chosen = pick.text ?? texts[pick.idx ?? 0];
        const value = pick.multi ? JSON.stringify([chosen]) : chosen;
        await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
      }
    }

    // Import del BIS femenino REAL (ZM3). Reimport = conflicto (ya importado): resumible.
    const imp = await importBisMeasurement({ buffer: femaleXlsx, evaluationId: FEMALE_COMPLETE_EVAL_ID, deviceId: null, actorId, actorEmail, ip: null });
    if (!imp.ok && imp.error?.code !== "conflict") throw new Error(`import BIS femenino fallo: ${imp.error?.message}`);

    // Pipeline real. Re-propagar = conflicto (ya hay diagnostico): resumible.
    const pipe = await runClinicalPipeline({ evaluationId: FEMALE_COMPLETE_EVAL_ID, actorId, actorEmail, ip: null });
    if (!pipe.ok && pipe.error?.code !== "conflict") throw new Error(`pipeline femenino fallo: ${pipe.error?.message}`);

    // Corrio como MUJER (sexo sellado F) y quedo con diagnostico completo: la mitad sexo-especifica
    // del motor se ejercito por el pipeline.
    const rep = (
      await db.select({ snapshot: schema.reports.snapshot }).from(schema.reports).where(eq(schema.reports.evaluationId, FEMALE_COMPLETE_EVAL_ID)).limit(1)
    )[0];
    expect(rep).toBeTruthy();
    const snap = rep.snapshot as { sexo?: string; dfi?: { complete?: boolean } };
    expect(snap.sexo).toBe("F");
    expect(snap.dfi?.complete).toBe(true);
  });
});
