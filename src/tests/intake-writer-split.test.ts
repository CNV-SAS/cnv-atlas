import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

// Reorganizacion del intake, checkpoint 1: el writer se partio en FIRMAR (crea el shell 'awaiting_survey'
// SIN survey_responses, con resume_token) y ESCRIBIR RESPUESTAS (crea survey_responses + answers, pasa a
// 'draft'). Se verifica contra la BD local seedada. Se AUTO-SALTA sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("intake-writer split (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let writer: any;
  let orgId: string, proId: string, svId: string;
  const createdPatients: string[] = [];
  const createdEvals: string[] = [];

  const consents = ["servicio", "datos_sensibles", "internacional_ia"].map((type) => ({
    type,
    consentVersion: "1.7",
    documentHash: "test-hash",
  }));

  const identity = (suffix: string) => ({
    documentType: "CC" as const,
    documentNumber: `SPLIT-${suffix}-${Date.now()}`,
    firstName: "Split",
    lastName: "Test",
    birthDate: "1990-01-01",
    sex: "M",
    country: "Colombia",
    city: "Medellin",
    email: "split@example.com",
    phone: null,
  });

  const signInput = (suffix: string, overrideConsents?: typeof consents) => ({
    organizationId: orgId,
    professionalId: proId,
    mode: "inicial" as const,
    patientId: null,
    identity: identity(suffix),
    consents: overrideConsents ?? consents,
    linkId: null,
    ipAddress: null,
    signature: null,
  });

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    writer = await import("@/modules/evaluations/data/intake-writer");
    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    svId = (
      await db
        .select({ id: schema.surveyVersions.id })
        .from(schema.surveyVersions)
        .orderBy(desc(schema.surveyVersions.publishedAt))
        .limit(1)
    )[0].id;
  });

  it("FIRMAR crea el shell 'awaiting_survey' con resume_token y SIN survey_responses", async () => {
    const res = await writer.signIntakeEvaluation(signInput("a"));
    createdEvals.push(res.evaluationId);
    createdPatients.push(res.patientId);

    expect(res.resumeToken).toMatch(/^[A-Za-z0-9_-]{20,}$/); // credencial larga, no adivinable

    const [ev] = await db
      .select({ status: schema.evaluations.status, token: schema.evaluations.resumeToken })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, res.evaluationId));
    expect(ev.status).toBe("awaiting_survey");
    expect(ev.token).toBe(res.resumeToken);

    // La clave del checkpoint: NO hay fila survey_responses (asi run-pipeline aborta limpio).
    const responses = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, res.evaluationId));
    expect(responses).toHaveLength(0);
  });

  it("ESCRIBIR RESPUESTAS crea la fila + answers y pasa a 'draft'", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("b"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);

    // Una pregunta cualquiera de la version activa, para una answer real.
    const [q] = await db
      .select({ id: schema.surveyQuestions.id })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId))
      .limit(1);

    const res = await writer.writeSurveyAnswers({
      resumeToken: signed.resumeToken,
      surveyVersionId: svId,
      answers: [{ questionId: q.id, answerValue: "Normal" }],
      ipAddress: null,
    });
    expect(res.evaluationId).toBe(signed.evaluationId);

    const [ev] = await db
      .select({ status: schema.evaluations.status })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, signed.evaluationId));
    expect(ev.status).toBe("draft"); // ya es una evaluacion normal

    const [resp] = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, signed.evaluationId));
    expect(resp).toBeTruthy();
    const answers = await db
      .select({ id: schema.surveyAnswers.id })
      .from(schema.surveyAnswers)
      .where(eq(schema.surveyAnswers.responseId, resp.id));
    expect(answers).toHaveLength(1);
  });

  it("el resume_token es de UN SOLO USO: un segundo envio con el mismo token falla (ya es 'draft')", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("c"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);

    await writer.writeSurveyAnswers({ resumeToken: signed.resumeToken, surveyVersionId: svId, answers: [], ipAddress: null });
    // Segundo intento: la evaluacion ya paso a 'draft', el token deja de habilitar.
    await expect(
      writer.writeSurveyAnswers({ resumeToken: signed.resumeToken, surveyVersionId: svId, answers: [], ipAddress: null }),
    ).rejects.toThrow(writer.ResumeTokenError);
  });

  it("el GATE (regla 15) sigue en la firma: sin las autorizaciones necesarias, no crea nada", async () => {
    const before = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.evaluations))[0].n;
    // Solo una de las tres necesarias -> el gate rechaza.
    await expect(
      writer.signIntakeEvaluation(signInput("d", [consents[0]])),
    ).rejects.toThrow(writer.ConsentGateError);
    const after = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.evaluations))[0].n;
    expect(after).toBe(before); // ninguna evaluacion nueva
  });

  afterAll(async () => {
    if (!db || !createdEvals.length) return;
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(schema.surveyAnswers).where(
        inArray(
          schema.surveyAnswers.responseId,
          db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, createdEvals)),
        ),
      );
      await tx.delete(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, createdEvals));
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, createdEvals));
      await tx.delete(schema.patientConsents).where(inArray(schema.patientConsents.patientId, createdPatients));
      await tx.delete(schema.patientContacts).where(inArray(schema.patientContacts.patientId, createdPatients));
      await tx.delete(schema.patientProfiles).where(inArray(schema.patientProfiles.patientId, createdPatients));
      await tx.delete(schema.patientProfessionalRelationships).where(inArray(schema.patientProfessionalRelationships.patientId, createdPatients));
      await tx.delete(schema.clinicalAuditLog).where(inArray(schema.clinicalAuditLog.entityId, [...createdEvals, ...createdPatients]));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, createdPatients));
    });
  });
});
