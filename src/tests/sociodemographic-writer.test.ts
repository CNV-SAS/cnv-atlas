import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq, inArray } from "drizzle-orm";

import { characterizationSchema } from "@/modules/evaluations/validations";

// Caracterizacion sociodemografica (E1). Dos bloques:
//  (1) VALIDACION pura (siempre corre, tambien en CI): characterizationSchema normaliza contra las listas.
//  (2) PERSISTENCIA contra BD real (se auto-salta sin DATABASE_URL): la fase 2 escribe los 4 campos al
//      perfil y el motivo a la evaluacion; perfil ausente (seguimiento) NO toca el perfil; vacio => null.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  /* sin .env.local: el bloque de BD se salta */
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe("characterizationSchema (validacion, sin BD)", () => {
  it("normaliza los campos de perfil contra sus listas (valor fuera de lista => null)", () => {
    const parsed = characterizationSchema.parse({
      profile: {
        educationLevel: "Posgrado",
        occupation: "Astronauta", // texto libre permitido (opcion "Otra")
        maritalStatus: "Inventado", // fuera de lista => null
        socioeconomicStratum: "3",
        ethnicity: "Indígena",
      },
      reasonForVisit: ["Rendimiento deportivo", "No existe", "Otro"],
    });
    expect(parsed?.profile).toEqual({
      educationLevel: "Posgrado",
      occupation: "Astronauta",
      maritalStatus: null,
      socioeconomicStratum: "3",
      ethnicity: "Indígena", // normalizada contra las categorias DANE (el gate de investigacion va en el writer)
      // ancestry: 2o campo de etnia (ascendencia), agregado en d0226b3 (2026-08-15). El input no lo trae,
      // asi que el schema lo default a null. El toEqual no se actualizo entonces y el test quedo rojo.
      ancestry: null,
    });
    // El motivo se filtra a las opciones conocidas (descarta "No existe").
    expect(parsed?.reasonForVisit).toEqual(["Rendimiento deportivo", "Otro"]);
  });

  it("sin profile (seguimiento) deja profile undefined y solo trae el motivo", () => {
    const parsed = characterizationSchema.parse({ reasonForVisit: ["Evaluación nutricional de rutina"] });
    expect(parsed?.profile).toBeUndefined();
    expect(parsed?.reasonForVisit).toEqual(["Evaluación nutricional de rutina"]);
  });

  it("null/undefined => null (no rompe el envio de la encuesta)", () => {
    expect(characterizationSchema.parse(null)).toBeNull();
    expect(characterizationSchema.parse(undefined)).toBeNull();
  });
});

describe.skipIf(!HAS_DB)("caracterizacion: persistencia (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let saveSurveyProgress: any;
  let completeSurvey: any;
  let orgId: string, proId: string, svId: string;

  const createdEvals: string[] = [];
  const createdPatients: string[] = [];

  // Shell firmado (awaiting_survey) con resume_token, como lo deja la fase 1.
  async function makeShell(suffix: string): Promise<{ evaluationId: string; patientId: string; token: string }> {
    const patientId = (
      await db
        .insert(schema.patients)
        .values({ organizationId: orgId, documentType: "CC", documentNumber: `SOCIO-${suffix}-${Date.now()}` })
        .returning({ id: schema.patients.id })
    )[0].id;
    createdPatients.push(patientId);
    await db.insert(schema.patientProfiles).values({ patientId, firstName: "Socio", lastName: suffix, sex: "M", birthDate: "1971-11-05" });
    await db.insert(schema.patientProfessionalRelationships).values({ patientId, professionalId: proId }).onConflictDoNothing();
    const token = `tok-${suffix}-${Date.now()}-${Math.floor(performance.now())}`;
    const evaluationId = (
      await db
        .insert(schema.evaluations)
        .values({ patientId, professionalId: proId, organizationId: orgId, type: "inicial", status: "awaiting_survey", resumeToken: token })
        .returning({ id: schema.evaluations.id })
    )[0].id;
    createdEvals.push(evaluationId);
    return { evaluationId, patientId, token };
  }

  const profileRow = (patientId: string) =>
    db.select().from(schema.patientProfiles).where(eq(schema.patientProfiles.patientId, patientId)).limit(1);
  const evalRow = (evaluationId: string) =>
    db.select().from(schema.evaluations).where(eq(schema.evaluations.id, evaluationId)).limit(1);

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    const writer = await import("@/modules/evaluations/data/intake-writer");
    saveSurveyProgress = writer.saveSurveyProgress;
    completeSurvey = writer.completeSurvey;
    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    proId = (await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).limit(1))[0].id;
    svId = (await db.select({ id: schema.surveyVersions.id }).from(schema.surveyVersions).orderBy(desc(schema.surveyVersions.publishedAt)).limit(1))[0].id;
  });

  afterAll(async () => {
    if (!db || !createdEvals.length) return;
    await db.transaction(async (tx: any) => {
      await tx.delete(schema.surveyAnswers).where(
        inArray(schema.surveyAnswers.responseId, db.select({ id: schema.surveyResponses.id }).from(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, createdEvals))),
      );
      await tx.delete(schema.surveyResponses).where(inArray(schema.surveyResponses.evaluationId, createdEvals));
      await tx.delete(schema.evaluations).where(inArray(schema.evaluations.id, createdEvals));
      await tx.delete(schema.patients).where(inArray(schema.patients.id, createdPatients));
    });
  });

  it("guardar progreso escribe los 4 campos al perfil y el motivo (JSON) a la evaluacion", async () => {
    const { evaluationId, patientId, token } = await makeShell("PERFIL");
    await saveSurveyProgress({
      resumeToken: token,
      surveyVersionId: svId,
      answers: [],
      ipAddress: null,
      characterization: {
        profile: { educationLevel: "Posgrado", occupation: "Ingeniero(a)", maritalStatus: "Soltero/a", socioeconomicStratum: "3" },
        reasonForVisit: ["Control de peso / composición corporal", "Detección de sarcopenia"],
      },
    });
    const p = (await profileRow(patientId))[0];
    expect(p.educationLevel).toBe("Posgrado");
    expect(p.occupation).toBe("Ingeniero(a)");
    expect(p.maritalStatus).toBe("Soltero/a");
    expect(p.socioeconomicStratum).toBe("3");
    const e = (await evalRow(evaluationId))[0];
    expect(JSON.parse(e.reasonForVisit)).toEqual(["Control de peso / composición corporal", "Detección de sarcopenia"]);
  });

  it("motivo vacio => null (limpia, no guarda '[]')", async () => {
    const { evaluationId, token } = await makeShell("VACIO");
    await saveSurveyProgress({ resumeToken: token, surveyVersionId: svId, answers: [], ipAddress: null, characterization: { reasonForVisit: [] } });
    const e = (await evalRow(evaluationId))[0];
    expect(e.reasonForVisit).toBeNull();
  });

  it("seguimiento (sin profile) NO toca el perfil ya capturado; solo actualiza el motivo", async () => {
    const { evaluationId, patientId, token } = await makeShell("SEGUIMIENTO");
    // Primera pasada: se captura el perfil.
    await saveSurveyProgress({
      resumeToken: token,
      surveyVersionId: svId,
      answers: [],
      ipAddress: null,
      characterization: { profile: { educationLevel: "Universitario completo", occupation: null, maritalStatus: null, socioeconomicStratum: "2" }, reasonForVisit: ["Rendimiento deportivo"] },
    });
    // Segunda pasada SIN profile (como en seguimiento): el perfil no se toca; el motivo si cambia.
    await saveSurveyProgress({ resumeToken: token, surveyVersionId: svId, answers: [], ipAddress: null, characterization: { reasonForVisit: ["Evaluación nutricional de rutina"] } });
    const p = (await profileRow(patientId))[0];
    expect(p.educationLevel).toBe("Universitario completo"); // intacto
    expect(p.socioeconomicStratum).toBe("2"); // intacto
    const e = (await evalRow(evaluationId))[0];
    expect(JSON.parse(e.reasonForVisit)).toEqual(["Evaluación nutricional de rutina"]);
  });

  it("completar la encuesta persiste la caracterizacion y pasa la evaluacion a 'draft'", async () => {
    const { evaluationId, patientId, token } = await makeShell("COMPLETA");
    await completeSurvey({
      resumeToken: token,
      surveyVersionId: svId,
      answers: [],
      ipAddress: null,
      characterization: { profile: { educationLevel: "Secundaria completa", occupation: "Docente / Profesor(a)", maritalStatus: "Casado/a", socioeconomicStratum: "4" }, reasonForVisit: ["Envejecimiento saludable / longevidad"] },
    });
    const p = (await profileRow(patientId))[0];
    expect(p.maritalStatus).toBe("Casado/a");
    const e = (await evalRow(evaluationId))[0];
    expect(e.status).toBe("draft");
    expect(JSON.parse(e.reasonForVisit)).toEqual(["Envejecimiento saludable / longevidad"]);
  });
});
