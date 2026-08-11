import { beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue } from "./fixtures/clinical-engine/dfi-complete-answers";

// SEED del smoke de P0 Parte 2 (trayectoria de EB-BIS). Fabrica, por la VIA REAL del pipeline, tres
// pacientes que ejercitan las tres superficies distintas: EMPEORO (confirmacion + PDF), MEJORO (PDF
// directo) e INTERVALO CORTO (aviso al profesional). El delta de EB se logra REAL con el mismo BIS
// variando la COMPLETITUD de la encuesta (completa ~EB 36, degradada ~EB 50: delta ~+14, verificado).
// No se fabrica nada: el pipeline sella la banda comparando las dos EB reales. Idempotente y resumible.
// Corre bajo vitest (el motor es server-only) solo con SEED_TRAJECTORY=1 y DATABASE_URL.

vi.mock("server-only", () => ({}));

let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL) && process.env.SEED_TRAJECTORY === "1";

const biody = biodyJson as Record<string, unknown>;
function bisRawRows(fixture: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number" && Number.isFinite(v)) rows.push({ name: normalizeHeader(k), value: String(v) });
  }
  return rows;
}

// IDs fijos, obvios como demo (nadie los confunde con reales).
const EMP_PAT = "a0000000-0000-4000-8000-0000000000d1";
const EMP_E1 = "a0000000-0000-4000-8000-0000000000d2"; // inicial, 4 meses atras, COMPLETA -> EB baja
const EMP_E2 = "a0000000-0000-4000-8000-0000000000d3"; // seguimiento hoy, DEGRADADA -> EB alta -> empeoro
const MEJ_PAT = "a0000000-0000-4000-8000-0000000000d4";
const MEJ_E1 = "a0000000-0000-4000-8000-0000000000d5"; // inicial, 4 meses atras, DEGRADADA -> EB alta
const MEJ_E2 = "a0000000-0000-4000-8000-0000000000d6"; // seguimiento hoy, COMPLETA -> EB baja -> mejoro
const SHT_PAT = "a0000000-0000-4000-8000-0000000000d7";
const SHT_E1 = "a0000000-0000-4000-8000-0000000000d8"; // inicial, hace 2 semanas
const SHT_E2 = "a0000000-0000-4000-8000-0000000000d9"; // seguimiento hoy -> intervalo corto -> aviso

// Subconjunto para la encuesta DEGRADADA (dfi.complete=false, EB mas alta por defaults).
const PARTIAL = new Set(["d2_19", "d3_23", "d3_24"]);

describe.skipIf(!RUN)("seed demo de trayectoria de EB-BIS (via pipeline real)", () => {
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
      await db.select({ profileId: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).where(eq(schema.professionalProfiles.id, proId)).limit(1)
    )[0].profileId;
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1))[0].id;
  });

  async function ensurePatient(patientId: string, apellido: string) {
    await db.insert(schema.patients).values({ id: patientId, organizationId: orgId, documentType: "CC", documentNumber: `TRAJ-DEMO-${patientId.slice(-2)}` }).onConflictDoNothing();
    await db.insert(schema.patientProfiles).values({ patientId, firstName: "Demo Trayectoria", lastName: apellido, sex: "M", birthDate: "1971-11-05", city: "Medellin" }).onConflictDoNothing();
    await db.insert(schema.patientProfessionalRelationships).values({ patientId, professionalId: proId }).onConflictDoNothing();
    // Correo del buzon de pruebas de Santiago: para que el envio del reporte sea ejercitable end-to-end.
    await db.insert(schema.patientContacts).values({ patientId, email: "sau.idk001@gmail.com" }).onConflictDoNothing();
  }

  async function ensureEval(patientId: string, evalId: string, type: string, measurementDate: string, complete: boolean) {
    const has = await db.select({ id: schema.reports.id }).from(schema.reports).where(eq(schema.reports.evaluationId, evalId)).limit(1);
    if (has.length > 0) return; // ya sembrada
    await db.insert(schema.evaluations).values({ id: evalId, patientId, professionalId: proId, organizationId: orgId, type, status: "in_progress" }).onConflictDoNothing();
    const respId = (await db.insert(schema.surveyResponses).values({ evaluationId: evalId, surveyVersionId: svId }).returning({ id: schema.surveyResponses.id }))[0].id;
    const questions = await db
      .select({ id: schema.surveyQuestions.id, fieldKey: schema.surveyQuestions.fieldKey })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId));
    for (const q of questions as { id: string; fieldKey: string | null }[]) {
      if (!q.fieldKey || !(q.fieldKey in ANSWERS)) continue;
      if (!complete && !PARTIAL.has(q.fieldKey)) continue; // degradada: solo el subconjunto
      const opts = await db.select({ text: schema.surveyOptions.optionText }).from(schema.surveyOptions).where(eq(schema.surveyOptions.questionId, q.id)).orderBy(schema.surveyOptions.orderIndex);
      const value = resolveAnswerValue(opts.map((o: { text: string }) => o.text), ANSWERS[q.fieldKey]);
      await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
    }
    const measId = (await db.insert(schema.bisMeasurements).values({ evaluationId: evalId, measurementDate: new Date(measurementDate) }).returning({ id: schema.bisMeasurements.id }))[0].id;
    await db.insert(schema.bisRawValues).values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
    const res = await runClinicalPipeline({ evaluationId: evalId, actorId, actorEmail: "traj-demo@cnv", ip: null });
    expect(res.ok).toBe(true);
  }

  it("EMPEORO: inicial completa (4 meses) + seguimiento degradado hoy -> banda empeoro sin confirmar", async () => {
    await ensurePatient(EMP_PAT, "Empeoro (smoke)");
    await ensureEval(EMP_PAT, EMP_E1, "inicial", "2026-04-05T10:00:00Z", true);
    await ensureEval(EMP_PAT, EMP_E2, "seguimiento", "2026-08-05T10:00:00Z", false);
    const t = (await db.select({ t: schema.reports.trajectory }).from(schema.reports).where(eq(schema.reports.evaluationId, EMP_E2)).limit(1))[0].t;
    expect(t?.band).toBe("empeoro");
  });

  it("MEJORO: inicial degradada (4 meses) + seguimiento completo hoy -> banda mejoro", async () => {
    await ensurePatient(MEJ_PAT, "Mejoro (smoke)");
    await ensureEval(MEJ_PAT, MEJ_E1, "inicial", "2026-04-05T10:00:00Z", false);
    await ensureEval(MEJ_PAT, MEJ_E2, "seguimiento", "2026-08-05T10:00:00Z", true);
    const t = (await db.select({ t: schema.reports.trajectory }).from(schema.reports).where(eq(schema.reports.evaluationId, MEJ_E2)).limit(1))[0].t;
    expect(t?.band).toBe("mejoro");
  });

  it("INTERVALO CORTO: dos evaluaciones a <12 semanas -> sin banda (aviso al profesional)", async () => {
    await ensurePatient(SHT_PAT, "Intervalo corto (smoke)");
    await ensureEval(SHT_PAT, SHT_E1, "inicial", "2026-07-22T10:00:00Z", true);
    await ensureEval(SHT_PAT, SHT_E2, "seguimiento", "2026-08-05T10:00:00Z", true);
    const t = (await db.select({ t: schema.reports.trajectory }).from(schema.reports).where(eq(schema.reports.evaluationId, SHT_E2)).limit(1))[0].t;
    expect(t).toBeNull();
  });
});
