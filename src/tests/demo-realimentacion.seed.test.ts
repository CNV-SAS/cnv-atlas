import { beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-demo-realimentacion-f10.json";
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue } from "./fixtures/clinical-engine/dfi-complete-answers";

// SEED del smoke del AVISO DE SEGURIDAD de sindrome de realimentacion. Siembra UN paciente de
// demostracion, por la VIA REAL del pipeline, cuya medicion dispara `alertaSindRealim` (fenotipo F10 +
// GEB < 1200 + IMC < 18.5). Existe porque un aviso de seguridad no se da por bueno leyendo el codigo:
// hay que verlo renderizar al menos una vez, y cada vez que se toque esa zona hace falta un caso con
// que probar. La fila BIS es SINTETICA y esta marcada como demo en el nombre del paciente; sus valores
// estan calibrados para el caso (candado en demo-realimentacion-fixture.test.ts), no son una medicion.
// Idempotente. Corre bajo vitest solo con SEED_REALIMENTACION=1 y DATABASE_URL.
//
// Donde mirar despues de sembrarlo: /evaluaciones/<id> -> subpestaña del Nutricionista. El aviso sale
// DOS veces, a proposito y con redacciones distintas: en el resumen clinico (informa que hay riesgo) y
// encima de la cadena calorica (instruye: iniciar en 10 kcal/kg/dia, ASPEN 2023).

vi.mock("server-only", () => ({}));

let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL) && process.env.SEED_REALIMENTACION === "1";

const biody = biodyJson as Record<string, unknown>;
function bisRawRows(fixture: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number" && Number.isFinite(v)) rows.push({ name: normalizeHeader(k), value: String(v) });
  }
  return rows;
}

// IDs fijos, obvios como demo (nadie los confunde con reales).
const PAT = "a0000000-0000-4000-8000-0000000000f1";
const EVAL = "a0000000-0000-4000-8000-0000000000f2";

describe.skipIf(!RUN)("seed demo del aviso de realimentacion (via pipeline real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string;

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline")).runClinicalPipeline;
    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
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
  });

  it("siembra el paciente demo y el pipeline sella alertaSindRealim = true", async () => {
    await db
      .insert(schema.patients)
      .values({ id: PAT, organizationId: orgId, documentType: "CC", documentNumber: "DEMO-REALIM-01" })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfiles)
      .values({
        patientId: PAT,
        firstName: "Demo Realimentación",
        lastName: "Bajo peso (smoke)",
        sex: "F",
        birthDate: "1958-03-12",
        city: "Medellin",
      })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId: PAT, professionalId: proId })
      .onConflictDoNothing();
    await db.insert(schema.patientContacts).values({ patientId: PAT, email: "sau.idk001@gmail.com" }).onConflictDoNothing();

    // treatments cuelga del DIAGNOSTICO (no de la evaluacion): se resuelve por diagnoses.evaluation_id.
    const dx = await db
      .select({ id: schema.diagnoses.id })
      .from(schema.diagnoses)
      .where(eq(schema.diagnoses.evaluationId, EVAL))
      .limit(1);

    if (dx.length === 0) {
      await db
        .insert(schema.evaluations)
        .values({ id: EVAL, patientId: PAT, professionalId: proId, organizationId: orgId, type: "inicial", status: "in_progress" })
        .onConflictDoNothing();
      const respId = (
        await db
          .insert(schema.surveyResponses)
          .values({ evaluationId: EVAL, surveyVersionId: svId })
          .returning({ id: schema.surveyResponses.id })
      )[0].id;
      // La encuesta se responde COMPLETA: el pipeline rechaza una incompleta (validacion de dominio).
      // Las preguntas que el fixture DFI cubre toman su respuesta; el resto cae a la primera opcion (o a
      // un valor neutro si es abierta). El relleno es por TIPO y no por lista, asi un bump de la encuesta
      // no deja el seed a medias en silencio.
      const questions = await db
        .select({
          id: schema.surveyQuestions.id,
          fieldKey: schema.surveyQuestions.fieldKey,
          tipo: schema.surveyQuestions.questionType,
        })
        .from(schema.surveyQuestions)
        .where(eq(schema.surveyQuestions.surveyVersionId, svId));
      for (const q of questions as { id: string; fieldKey: string | null; tipo: string }[]) {
        const opts = await db
          .select({ text: schema.surveyOptions.optionText })
          .from(schema.surveyOptions)
          .where(eq(schema.surveyOptions.questionId, q.id))
          .orderBy(schema.surveyOptions.orderIndex);
        const texts = opts.map((o: { text: string }) => o.text);
        let value: string;
        if (q.fieldKey && q.fieldKey in ANSWERS) {
          value = resolveAnswerValue(texts, ANSWERS[q.fieldKey]);
        } else if (texts.length > 0) {
          value = q.tipo === "opcion_multiple" ? JSON.stringify([texts[0]]) : texts[0];
        } else {
          value = q.tipo === "numero" ? "1" : "Sin dato (paciente demo)";
        }
        await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
      }
      const measId = (
        await db
          .insert(schema.bisMeasurements)
          .values({ evaluationId: EVAL, measurementDate: new Date("2026-08-20T10:00:00Z") })
          .returning({ id: schema.bisMeasurements.id })
      )[0].id;
      await db
        .insert(schema.bisRawValues)
        .values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
      const res = await runClinicalPipeline({ evaluationId: EVAL, actorId, actorEmail: "realim-demo@cnv", ip: null });
      expect(res.ok, res.ok ? "" : JSON.stringify(res.error)).toBe(true);
    }

    // Lo que hace util al seed: que el protocolo SELLADO traiga el fenotipo y el aviso. Si esto falla,
    // el caso dejo de disparar y el smoke estaria mirando una pantalla sin aviso.
    const dxId = (
      await db.select({ id: schema.diagnoses.id }).from(schema.diagnoses).where(eq(schema.diagnoses.evaluationId, EVAL)).limit(1)
    )[0].id;
    const t = (
      await db
        .select({ p: schema.treatments.protocolSuggested })
        .from(schema.treatments)
        .where(eq(schema.treatments.diagnosisId, dxId))
        .limit(1)
    )[0].p;
    expect(t.fenotipo.id).toBe("F10");
    expect(t.alertaSindRealim).toBe(true);
  });
});
