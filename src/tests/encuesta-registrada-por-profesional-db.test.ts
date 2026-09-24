import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA ENCUESTA REGISTRADA POR EL PROFESIONAL (2026-09-24) ═══
//
// LA NECESIDAD: hay pacientes que firman y dejan la encuesta sin responder (sin conexión, o la llenan con
// la profesional en consulta). La evaluación quedaba esperando y la única acción era CERRARLA, o sea
// archivar un consentimiento ya firmado.
//
// LO QUE SE PRUEBA AQUÍ, que es lo que no se ve leyendo el código:
//
//   · que al cerrarla el profesional quede sellado QUIÉN la cerró (`captured_by`), porque una encuesta
//     respondida por otro NO es la misma evidencia: la sección S de la HC dice "lo que el paciente refiere";
//   · que por el camino del paciente siga quedando NULA, que es el caso normal;
//   · y que sea EL MISMO BORRADOR: lo que el paciente dejó a medias en casa no se pierde cuando ella abre.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let professionalId = "";
let profileId = "";
let organizationId = "";
let surveyVersionId = "";
let preguntas: { id: string; field_key: string | null }[] = [];
const creados: string[] = [];

/** Un paciente con una evaluación FIRMADA y sin responder, como la deja el intake. */
async function shellFirmado(): Promise<{ evaluationId: string; resumeToken: string }> {
  const { db } = await import("@/db");
  const documento = `ZZ-ENC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [paciente] = await db.execute<{ id: string }>(dsql`
    insert into patients (organization_id, document_type, document_number)
    values (${organizationId}, 'CC', ${documento}) returning id`);
  creados.push(paciente.id);
  await db.execute(dsql`
    insert into patient_professional_relationships (patient_id, professional_id)
    values (${paciente.id}, ${professionalId})`);
  await db.execute(dsql`
    insert into patient_profiles (patient_id, first_name, last_name, sex)
    values (${paciente.id}, 'ZZ', 'Encuesta', 'M')`);
  const resumeToken = `zz-token-${documento}`;
  const [ev] = await db.execute<{ id: string }>(dsql`
    insert into evaluations (organization_id, patient_id, professional_id, type, status, resume_token)
    values (${organizationId}, ${paciente.id}, ${professionalId}, 'inicial', 'awaiting_survey', ${resumeToken})
    returning id`);
  return { evaluationId: ev.id, resumeToken };
}

describe.skipIf(!HAS_DB)("la encuesta que registra el profesional (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    professionalId = prof.id;
    profileId = prof.profile_id;
    organizationId = prof.organization_id;
    const [v] = await db.execute<{ id: string }>(
      dsql`select id from survey_versions order by published_at desc limit 1`,
    );
    surveyVersionId = v.id;
    preguntas = await db.execute<{ id: string; field_key: string | null }>(
      dsql`select id, field_key from survey_questions where survey_version_id = ${surveyVersionId} limit 4`,
    );
  }, 30_000);

  afterAll(async () => {
    const { db } = await import("@/db");
    // Las evaluaciones NO caen por cascada desde el paciente (a proposito: un registro clinico no se borra
    // por borrar una ficha), asi que se quitan primero las de la prueba.
    for (const id of creados) {
      await db.execute(dsql`delete from evaluations where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
  });

  it("al cerrarla EL PROFESIONAL queda sellado quién la cerró", async () => {
    const { db } = await import("@/db");
    const { completeSurvey } = await import("@/modules/evaluations/data/intake-writer");
    const { evaluationId } = await shellFirmado();
    const ultimo = creados[creados.length - 1];
    const [ev] = await db.execute<{ resume_token: string }>(
      dsql`select resume_token from evaluations where id = ${evaluationId}`,
    );

    await completeSurvey({
      resumeToken: ev.resume_token,
      surveyVersionId,
      answers: preguntas.map((q) => ({ questionId: q.id, answerValue: "x" })),
      ipAddress: null,
      characterization: null,
      capturedBy: profileId,
    });

    const [r] = await db.execute<{ captured_by: string | null }>(dsql`
      select sr.captured_by from survey_responses sr where sr.evaluation_id = ${evaluationId}`);
    expect(r.captured_by, "no quedó quién la registró").toBe(profileId);
    // Y la evaluación ya es normal: el camino es el mismo, solo cambia quién cerró.
    const [estado] = await db.execute<{ status: string }>(
      dsql`select status from evaluations where id = ${evaluationId}`,
    );
    expect(estado.status).toBe("draft");
    expect(ultimo).toBeTruthy();
  }, 30_000);

  it("por el camino del PACIENTE sigue quedando nula, que es el caso normal", async () => {
    const { db } = await import("@/db");
    const { completeSurvey } = await import("@/modules/evaluations/data/intake-writer");
    const { evaluationId, resumeToken } = await shellFirmado();

    await completeSurvey({
      resumeToken,
      surveyVersionId,
      answers: preguntas.map((q) => ({ questionId: q.id, answerValue: "x" })),
      ipAddress: null,
      characterization: null,
    });

    const [r] = await db.execute<{ captured_by: string | null }>(
      dsql`select captured_by from survey_responses where evaluation_id = ${evaluationId}`,
    );
    expect(r.captured_by).toBeNull();
  }, 30_000);

  it("ES EL MISMO BORRADOR: lo que el paciente dejó a medias no se pierde", async () => {
    const { db } = await import("@/db");
    const { saveSurveyProgress, completeSurvey } = await import("@/modules/evaluations/data/intake-writer");
    const { evaluationId, resumeToken } = await shellFirmado();

    // El paciente responde DOS en casa y no envía.
    await saveSurveyProgress({
      resumeToken,
      surveyVersionId,
      answers: preguntas.slice(0, 2).map((q) => ({ questionId: q.id, answerValue: "en casa" })),
      ipAddress: null,
      characterization: null,
    });
    const [borrador] = await db.execute<{ n: number; capturada: string | null }>(dsql`
      select count(sa.id)::int as n, max(sr.captured_by::text) as capturada
        from survey_responses sr left join survey_answers sa on sa.response_id = sr.id
       where sr.evaluation_id = ${evaluationId}`);
    expect(borrador.n).toBe(2);
    // Guardar progreso NO decide autoría: la decide quien cierra.
    expect(borrador.capturada).toBeNull();

    // Ella abre y termina: llega el conjunto completo (el formulario precarga lo ya respondido).
    await completeSurvey({
      resumeToken,
      surveyVersionId,
      answers: preguntas.map((q, i) => ({ questionId: q.id, answerValue: i < 2 ? "en casa" : "en consulta" })),
      ipAddress: null,
      characterization: null,
      capturedBy: profileId,
    });

    const filas = await db.execute<{ answer_value: string }>(dsql`
      select sa.answer_value from survey_answers sa
        join survey_responses sr on sr.id = sa.response_id
       where sr.evaluation_id = ${evaluationId}`);
    expect(filas.length).toBe(preguntas.length);
    expect(filas.filter((f) => f.answer_value === "en casa").length, "se perdió lo que respondió en casa").toBe(2);
    // UNA SOLA FILA DE RESPUESTAS por evaluación: abrir por el otro camino no crea un borrador nuevo.
    const [respuestas] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from survey_responses where evaluation_id = ${evaluationId}`,
    );
    expect(respuestas.n).toBe(1);
  }, 30_000);
});
