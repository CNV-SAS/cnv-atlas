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
const DOC_NUMBER = "GOLDEN-0001";
// DOB del donante real del BIS gold (~54 años): la edad alimenta EB-BIS/IAE, asi que debe
// ser la suya para que el envejecimiento biologico lea coherente con su medicion.
const BIRTH_DATE = "1971-11-05";
const SEX = "Male"; // se conserva en ingles como el export real (borde de normalizacion)
// Nombre de demo OBVIO: nadie debe confundirlo con un paciente real.
const FIRST_NAME = "Demo";
const LAST_NAME = "GoldenPath (motor real)";
// Correo del paciente demo: plus-addressing al buzon corporativo (+demo) para que el envio de
// reporte quede ejercitable de punta a punta con un destino real.
const PATIENT_EMAIL = "corporativo+demo@cnvsystem.com";
// IDs fijos de las notas del profesional. Demo GoldenPath es tambien el target del smoke de
// auditoria (Nivel b/c): tiene notas reales en las 3 tablas narrativas. Reemplaza la cadena
// demo fabricada a mano (99999999), retirada del node seed.
const EVAL_NOTE_ID = "a0000000-0000-4000-8000-0000000000b1";
const DIAG_NOTE_ID = "a0000000-0000-4000-8000-0000000000b2";
const TREAT_NOTE_ID = "a0000000-0000-4000-8000-0000000000b3";

// Construye en memoria el XLSX que consume el import BIS real, desde el gold JSON: hoja
// "Measures" (la que exige el parser), fila 1 = headers exactos, fila 2 = valores reales.
async function buildGoldXlsx(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Measures");
  const gold = biodyGold as Record<string, unknown>;
  const keys = Object.keys(gold);
  ws.addRow(keys);
  ws.addRow(keys.map((k) => (gold[k] ?? null) as ExcelJS.CellValue));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// Respuestas alineadas al perfil documentado que el golden del DFI empareja con este BIS
// (encuesta-sintetica.json: "hombre 54a, IMC 27.5, sobrepeso leve, sedentario moderado, sin
// TCA, 1 antecedente familiar"), pero expresadas con las OPCIONES REALES de la encuesta (la
// sintetica usa d-fields del prototipo que la encuesta real no recolecta, p. ej. d1_9/d1_16).
// Elegidas por indice/texto sobre las opciones ya sembradas, para que el acoplamiento
// caracter-por-caracter con el motor no dependa de reescribir cadenas con en-dash. multi = se
// guarda como JSON de option_text, como el intake real.
type Pick = { multi: boolean; idx?: number; text?: string };
const ANSWERS: Record<string, Pick> = {
  d2_19: { multi: false, idx: 3 }, // percepcion corporal: Sobrepeso (coherente con IMC 27.5)
  d2_20: { multi: false, idx: 1 }, // satisfaccion con el peso: Insatisfecho/a
  d2_21: { multi: true, text: "Ninguno" }, // metodos para cambiar peso: ninguno (sin conducta de riesgo)
  d2_22: { multi: false, idx: 1 }, // pierde control al comer: Rara vez
  d3_23: { multi: false, idx: 2 }, // dias de actividad fisica: 2 (sedentario moderado)
  d3_24: { multi: false, idx: 2 }, // duracion de la sesion: 30-45 min
  d3_26: { multi: false, idx: 2 }, // horas de sueno: 6-7 horas
  d3_30: { multi: false, idx: 0 }, // tabaco: Nunca he fumado
  d3_31: { multi: false, idx: 1 }, // alcohol: 1-2 veces al mes (ocasional)
  d5_36: { multi: false, idx: 1 }, // HTA diagnosticada: No
  d5_38: { multi: true, text: "DM2 (diabetes)" }, // 1 antecedente familiar: DM2
  d5_39: { multi: true, text: "Ninguna" }, // diagnosticos personales: Ninguna
  d8_61: { multi: false, idx: 0 }, // acceso a alimentos frescos: Si, siempre
  d8_62: { multi: false, idx: 0 }, // suficiente comida en el hogar: No, nunca
};

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
  let xlsx: ArrayBuffer; // XLSX con valores reales, construido desde el gold JSON

  beforeAll(async () => {
    xlsx = await buildGoldXlsx();
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
});
