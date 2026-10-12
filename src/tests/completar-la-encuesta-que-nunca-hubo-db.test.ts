import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ COMPLETAR UNA ENCUESTA QUE NUNCA EXISTIO (Santiago, 2026-10-12) ═══
//
// ── EL CASO, Y POR QUE NO SE PARECE AL DE AL LADO ──────────────────────────────────────────────────
//
// En el lote del HTML del 2 de octubre entraron 15 consultas con su consentimiento aceptado y su medicion
// COMPLETA (bioelectrica, circunferencias, peso, talla, fuerza prensil) y CERO respuestas de encuesta. El
// importador no crea la fila de `survey_responses` cuando no hay ni una respuesta que meter, y hace bien:
// una fila vacia afirmaria que hubo encuesta.
//
// La consecuencia la vio Santiago desde el otro lado: la puerta del diagnostico ofrece "Completar la
// encuesta con el paciente" como salida, y para estas 15 esa salida **no llevaba a ninguna parte**. El
// lector devolvia null, la pantalla rendia un formulario sin ninguna pregunta, y guardar respondia
// "not_editable". Es la regla que ese mismo codigo ya tiene escrita: un enlace que no resuelve nada es
// peor que ninguno.
//
// ── POR QUE CONTRA LA BASE REAL ────────────────────────────────────────────────────────────────────
//
// Porque lo que importa no es que la funcion devuelva ok: es QUE SE ESCRIBE en la fila que crea, y eso
// solo se ve en la base.
//
//   · `survey_version_id`: la version VIGENTE. Es la regla dura 7; sin ella un `dfi.complete` sellado no se
//     puede reconstruir, porque no se sabe contra que lista de field_key se midio la completitud.
//   · `captured_by`: el profesional. NULO significa "la autodiligencio el paciente", y aqui no fue asi. La
//     seccion S de la historia clinica dice "lo que el paciente refiere", y quien pregunta cambia lo que la
//     gente responde: no es la misma evidencia.
//   · `import_batch_id` NULO: estas respuestas no las trajo el archivo, se tomaron semanas despues. Es lo
//     unico que despues permite distinguir en la base lo importado de lo completado a mano.
//
// Y EL CASO QUE NO DEBE CAMBIAR: cuando la respuesta YA existe (el paciente la dejo a medias), completarla
// no reescribe quien la cerro. Si lo hiciera, una encuesta que el paciente SI autodiligencio quedaria
// atribuida al profesional por haberle corregido una linea.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("completar la encuesta de una consulta que entro sin ninguna (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let saveSurveyEdit: any;
  let professionalId = "";
  let profileId = "";
  let organizationId = "";
  let surveyVersionId = "";
  let preguntas: { id: string }[] = [];
  const pacientes: string[] = [];

  /** Una consulta como la deja el import del HTML: in_progress, sin resume_token y SIN survey_responses. */
  const consultaImportadaSinEncuesta = async (): Promise<string> => {
    const documento = `ZZ-SINENC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [paciente] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${organizationId}, 'CC', ${documento}) returning id`);
    pacientes.push(paciente.id);
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id)
      values (${paciente.id}, ${professionalId})`);
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, sex)
      values (${paciente.id}, 'ZZ', 'SinEncuesta', 'F')`);
    const [ev] = await db.execute(dsql`
      insert into evaluations (organization_id, patient_id, professional_id, type, status)
      values (${organizationId}, ${paciente.id}, ${professionalId}, 'inicial', 'in_progress')
      returning id`);
    return ev.id;
  };

  const respuestaDe = async (evaluationId: string): Promise<any> => {
    const [r] = await db.execute(dsql`
      select id, survey_version_id, captured_by, import_batch_id
        from survey_responses where evaluation_id = ${evaluationId}`);
    return r ?? null;
  };

  const rastro = async (evaluationId: string): Promise<any> => {
    const [r] = await db.execute(dsql`
      select payload from clinical_audit_log
       where entity_type = 'evaluation' and entity_id = ${evaluationId}
         and event = 'evaluation.survey_edited'
       order by created_at desc limit 1`);
    return r?.payload ?? null;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ saveSurveyEdit } = await import("@/modules/evaluations/data/survey-edit-writer"));
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    professionalId = prof.id;
    profileId = prof.profile_id;
    organizationId = prof.organization_id;
    const [v] = await db.execute(
      dsql`select id from survey_versions order by published_at desc limit 1`,
    );
    surveyVersionId = v.id;
    preguntas = await db.execute(
      dsql`select id from survey_questions where survey_version_id = ${surveyVersionId} order by order_index limit 4`,
    );
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    // `clinical_audit_log` es append-only por trigger (y debe serlo: es la bitacora clinica). Para limpiar
    // lo que ESTA prueba escribio se desactivan los triggers de sesion, igual que en el candado del sexo.
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of pacientes) {
      const evs = await db.execute(dsql`select id from evaluations where patient_id = ${id}`);
      for (const e of evs) {
        await db.execute(dsql`delete from clinical_audit_log where entity_id = ${e.id}`);
      }
      // Las evaluaciones NO caen por cascada desde el paciente, a proposito: un registro clinico no se
      // borra por borrar una ficha.
      await db.execute(dsql`delete from evaluations where patient_id = ${id}`);
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  const actor = () => ({ actorId: profileId, actorEmail: "candado@cnv.test", ip: null });

  it("LA SALIDA DEL DIAGNOSTICO AHORA RESUELVE: se guarda aunque no hubiera fila de respuesta", async () => {
    const evaluationId = await consultaImportadaSinEncuesta();
    expect(
      await respuestaDe(evaluationId),
      "el fixture tiene que empezar SIN fila: si la trae, esta prueba no prueba el caso",
    ).toBeNull();

    const r = await saveSurveyEdit({
      evaluationId,
      ...actor(),
      answers: preguntas.map((q) => ({ questionId: q.id, answerValue: "x" })),
    });
    expect(
      r,
      "era el unico camino que la pantalla ofrecia, y devolvia not_editable",
    ).toEqual({ ok: true, answered: preguntas.length });

    const guardadas = await db.execute(dsql`
      select count(*)::int as n from survey_answers sa
       join survey_responses sr on sr.id = sa.response_id
       where sr.evaluation_id = ${evaluationId}`);
    expect(guardadas[0].n).toBe(preguntas.length);
  }, 30_000);

  it("y la fila que crea queda sellada: version vigente, quien pregunto, y NO es del lote", async () => {
    const evaluationId = await consultaImportadaSinEncuesta();
    await saveSurveyEdit({
      evaluationId,
      ...actor(),
      answers: [{ questionId: preguntas[0].id, answerValue: "x" }],
    });

    const resp = await respuestaDe(evaluationId);
    expect(
      resp.survey_version_id,
      "sin la version no se puede reconstruir contra que instrumento se midio la completitud (regla dura 7)",
    ).toBe(surveyVersionId);
    expect(
      resp.captured_by,
      "nulo significa que la autodiligencio el paciente, y aqui la pregunto el profesional",
    ).toBe(profileId);
    expect(
      resp.import_batch_id,
      "estas respuestas no las trajo el archivo: se tomaron despues, y es lo que las distingue",
    ).toBeNull();
    expect(
      (await rastro(evaluationId)).respuestaCreada,
      "el rastro tiene que decir que no hubo encuesta que completar, sino una que se registro entera",
    ).toBe(true);
  }, 30_000);

  it("EL CASO QUE NO DEBE CAMBIAR: si el paciente ya la habia respondido, no se le atribuye al profesional", async () => {
    const evaluationId = await consultaImportadaSinEncuesta();
    // Como la deja el paciente: fila propia, captured_by NULO.
    await db.execute(dsql`
      insert into survey_responses (evaluation_id, survey_version_id)
      values (${evaluationId}, ${surveyVersionId})`);

    const r = await saveSurveyEdit({
      evaluationId,
      ...actor(),
      answers: [{ questionId: preguntas[0].id, answerValue: "x" }],
    });
    expect(r.ok).toBe(true);

    const resp = await respuestaDe(evaluationId);
    expect(
      resp.captured_by,
      "corregirle una linea a una encuesta que el paciente SI autodiligencio no la vuelve del profesional",
    ).toBeNull();
    expect((await rastro(evaluationId)).respuestaCreada).toBe(false);

    // Y SIGUE SIENDO UNA SOLA FILA: dos respuestas para una evaluacion dejarian al lector eligiendo por
    // fecha cual es la buena, y la historia clinica mostraria la que no es.
    const filas = await db.execute(
      dsql`select count(*)::int as n from survey_responses where evaluation_id = ${evaluationId}`,
    );
    expect(filas[0].n).toBe(1);
  }, 30_000);
});
