import { beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import { pickDemoProfessional, reassignDemoEvaluations } from "./fixtures/demo-professional";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue } from "./fixtures/clinical-engine/dfi-complete-answers";
import { fillSurveyComplete, lastOptionByFieldKey } from "./fixtures/survey-fill";

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
// SEGUNDO caso EMPEORO, para el bloque de "confirmar y agendar" (2026-08-24). Existe porque ese bloque se
// CONSUME al aprobar y enviar el reporte, y no hay forma de reemitirlo: el primero (EMP_*) ya se gasto en
// un smoke. No es duplicar por duplicar; es que el caso es de UN SOLO USO mientras no exista la reemision.
const EMP2_PAT = "a0000000-0000-4000-8000-0000000000e1";
const EMP2_E1 = "a0000000-0000-4000-8000-0000000000e2"; // inicial, 4 meses atras, COMPLETA
const EMP2_E2 = "a0000000-0000-4000-8000-0000000000e3"; // seguimiento hoy, DEGRADADA -> empeoro
// TERCER caso EMPEORO. El segundo se gasto en el smoke del 24 (se confirmo la comunicacion), y el bloque
// solo se ve ANTES de confirmar. Mientras no exista la reemision, cada smoke del bloque ambar consume un
// par de evaluaciones: por eso el candado de abajo avisa, y por eso se siembra otro.
const EMP3_PAT = "a0000000-0000-4000-8000-0000000000f4";
const EMP3_E1 = "a0000000-0000-4000-8000-0000000000f5";
const EMP3_E2 = "a0000000-0000-4000-8000-0000000000f6";
const SHT_PAT = "a0000000-0000-4000-8000-0000000000d7";
const SHT_E1 = "a0000000-0000-4000-8000-0000000000d8"; // inicial, hace 2 semanas
const SHT_E2 = "a0000000-0000-4000-8000-0000000000d9"; // seguimiento hoy -> intervalo corto -> aviso

// Preguntas del DFI que la encuesta DEGRADADA responde IGUAL que la buena. El resto va al extremo del
// catalogo. El subconjunto se conserva del diseno original para que las dos EB difieran, no coincidan.
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
    // El dueño se elige por PROFESION y de forma determinista, no "el primero" (ver demo-professional.ts:
    // un LIMIT 1 sin ORDER BY le tocaba el MEDICO y la pagina daba 404 por RLS). Y se REPARA lo ya sembrado.
    const pro = await pickDemoProfessional(db, schema, "nutricionista");
    proId = pro.proId;
    actorId = pro.actorId;
    await reassignDemoEvaluations(db, schema, [EMP_E1, EMP_E2, EMP2_E1, EMP2_E2, EMP3_E1, EMP3_E2, MEJ_E1, MEJ_E2, SHT_E1, SHT_E2], proId);
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1))[0].id;
  });

  async function ensurePatient(patientId: string, apellido: string) {
    await db.insert(schema.patients).values({ id: patientId, organizationId: orgId, documentType: "CC", documentNumber: `TRAJ-DEMO-${patientId.slice(-2)}` }).onConflictDoNothing();
    await db.insert(schema.patientProfiles).values({ patientId, firstName: "Demo Trayectoria", lastName: apellido, sex: "M", birthDate: "1971-11-05", city: "Medellin" }).onConflictDoNothing();
    await db.insert(schema.patientProfessionalRelationships).values({ patientId, professionalId: proId }).onConflictDoNothing();
    // Correo del buzon de pruebas de Santiago: para que el envio del reporte sea ejercitable end-to-end.
    await db.insert(schema.patientContacts).values({ patientId, email: "sau.idk001@gmail.com" }).onConflictDoNothing();
  }

  // El deterioro YA NO se logra dejando la encuesta a medias: el gate de completitud (Gildardo §1 del
  // 2026-08-13) prohibe diagnosticar con encuesta incompleta, y eso dejo al seed sin poder crear ni un caso
  // (respondia 31 de 64). Ahora las DOS encuestas van completas y lo que cambia son las RESPUESTAS: la
  // degradada responde el extremo del catalogo en las preguntas del DFI que no estan en PARTIAL. La banda
  // no se asume: la sella el pipeline y cada caso la assertea.
  async function ensureEval(patientId: string, evalId: string, type: string, measurementDate: string, buena: boolean) {
    const has = await db.select({ id: schema.reports.id }).from(schema.reports).where(eq(schema.reports.evaluationId, evalId)).limit(1);
    if (has.length > 0) return; // ya sembrada
    await db.insert(schema.evaluations).values({ id: evalId, patientId, professionalId: proId, organizationId: orgId, type, status: "in_progress" }).onConflictDoNothing();
    const respId = (await db.insert(schema.surveyResponses).values({ evaluationId: evalId, surveyVersionId: svId }).returning({ id: schema.surveyResponses.id }))[0].id;
    const overrides = buena
      ? {}
      : await lastOptionByFieldKey(db, schema, eq, svId, Object.keys(ANSWERS).filter((k) => !PARTIAL.has(k)));
    await fillSurveyComplete(db, schema, eq, respId, svId, { overrides, fixture: ANSWERS, resolve: resolveAnswerValue });
    const measId = (await db.insert(schema.bisMeasurements).values({ evaluationId: evalId, measurementDate: new Date(measurementDate) }).returning({ id: schema.bisMeasurements.id }))[0].id;
    await db.insert(schema.bisRawValues).values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
    const res = await runClinicalPipeline({ evaluationId: evalId, actorId, actorEmail: "traj-demo@cnv", ip: null });
    expect(res.ok, res.ok ? "" : JSON.stringify(res.error)).toBe(true);
  }

  // EL BLOQUE AMBAR DE "CONFIRMAR Y AGENDAR" SOLO SE VE CON EL REPORTE EN `draft` (report-card.tsx:57:
  // `status === "draft" && band === "empeoro" && !communicated`). Es decir: el caso se CONSUME al aprobar
  // y enviar el reporte, y despues no hay forma de volver a verlo, porque un reporte enviado no se puede
  // reenviar ni reemitir (ver el hallazgo del 2026-08-24). Por eso el seed avisa cuando el caso ya se gasto:
  // sin este chequeo, quien lo corra vuelve a la pantalla, no ve el bloque, y cree que esta roto.
  it("EMPEORO: avisa si el caso NUEVO ya se consumio (el bloque ambar es de un solo uso)", async () => {
    const { eq } = await import("drizzle-orm");
    const [r] = await db
      .select({ status: schema.reports.status })
      .from(schema.reports)
      .where(eq(schema.reports.evaluationId, EMP3_E2))
      .limit(1);
    if (!r) return; // todavia no sembrado; la prueba de abajo lo crea
    expect(
      r.status,
      `El reporte del caso EMPEORO vigente esta en "${r.status}", no en "draft": el bloque de confirmar y agendar ` +
        "ya se consumio en un smoke anterior y NO se puede volver a ver (un reporte enviado no se reenvia " +
        "ni se reemite). Para volver a probarlo hace falta un par de evaluaciones nuevo.",
    ).toBe("draft");
  });

  it("EMPEORO: inicial completa (4 meses) + seguimiento degradado hoy -> banda empeoro sin confirmar", async () => {
    await ensurePatient(EMP_PAT, "Empeoro (smoke)");
    await ensureEval(EMP_PAT, EMP_E1, "inicial", "2026-04-05T10:00:00Z", true);
    await ensureEval(EMP_PAT, EMP_E2, "seguimiento", "2026-08-05T10:00:00Z", false);
    const t = (await db.select({ t: schema.reports.trajectory }).from(schema.reports).where(eq(schema.reports.evaluationId, EMP_E2)).limit(1))[0].t;
    expect(t?.band).toBe("empeoro");
  });

  it("EMPEORO (2o caso): CONSUMIDO en el smoke del 24; la banda sellada no cambia", async () => {
    const { eq } = await import("drizzle-orm");
    await ensurePatient(EMP2_PAT, "Empeoro 2 (confirmar y agendar)");
    await ensureEval(EMP2_PAT, EMP2_E1, "inicial", "2026-04-05T10:00:00Z", true);
    await ensureEval(EMP2_PAT, EMP2_E2, "seguimiento", "2026-08-05T10:00:00Z", false);
    const [r] = await db
      .select({ status: schema.reports.status, t: schema.reports.trajectory })
      .from(schema.reports)
      .where(eq(schema.reports.evaluationId, EMP2_E2))
      .limit(1);
    // La banda es INMUTABLE (trigger): sigue diciendo empeoro aunque el reporte ya se enviara. Lo que se
    // gasto es la VISIBILIDAD del bloque ambar, que exige draft + sin confirmar. Por eso hay un tercero.
    expect(r.t?.band).toBe("empeoro");
  });

  it("EMPEORO (3er caso, vigente para el bloque de confirmar y agendar)", async () => {
    const { eq } = await import("drizzle-orm");
    await ensurePatient(EMP3_PAT, "Empeoro 3 (confirmar y agendar)");
    await ensureEval(EMP3_PAT, EMP3_E1, "inicial", "2026-04-05T10:00:00Z", true);
    await ensureEval(EMP3_PAT, EMP3_E2, "seguimiento", "2026-08-05T10:00:00Z", false);
    const [r] = await db
      .select({ status: schema.reports.status, t: schema.reports.trajectory, com: schema.reports.trajectoryCommunicatedAt })
      .from(schema.reports)
      .where(eq(schema.reports.evaluationId, EMP3_E2))
      .limit(1);
    expect(r.t?.band).toBe("empeoro");
    // Las TRES condiciones que hacen visible el bloque ambar, juntas (report-card.tsx:57).
    expect(r.status).toBe("draft");
    expect(r.com).toBeNull();
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
