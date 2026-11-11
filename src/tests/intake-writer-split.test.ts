import { SQL_VERSION_VIGENTE } from "@/modules/evaluations/version-vigente-sql";
import { sql as dsqlVersion } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { eq, inArray, sql } from "drizzle-orm";

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
        .execute(dsqlVersion.raw(`select ${SQL_VERSION_VIGENTE} as id`)) as unknown as { id: string }[]
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

    const res = await writer.completeSurvey({
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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // DOS GUARDADOS A LA VEZ SOBRE LA MISMA CONSULTA  ·  EL CANDADO DEL 2026-11-10
  //
  // EL CASO REAL, con una paciente de Angela: un guardado de avance fallo con `duplicate key value
  // violates unique constraint "survey_answers_response_question_unique"` (23505) y la transaccion
  // rechazo las 52 respuestas del lote. No fue un payload con una pregunta repetida: fue el `delete` +
  // `insert` de DOS escrituras simultaneas sobre la misma consulta, que es el caso de uso normal de
  // *"Responder la encuesta con el paciente"* (la profesional y el telefono de la paciente trabajan
  // sobre el MISMO borrador, y el formulario autoguarda solo).
  //
  // POR QUE ESTE CASO VA CONTRA LA BASE Y NO PUEDE SER DE UNIDAD: lo que se comprueba es que Postgres
  // SERIALIZA las dos transacciones (`for update` sobre la fila de la consulta). Sin base no hay dos
  // transacciones, y un mock las ordenaria por construccion, que es justo lo que no hay que asumir.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("DOS guardados simultaneos no se pisan: ni 23505, ni dos filas de respuestas", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("conc"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);
    const qs = await db
      .select({ id: schema.surveyQuestions.id })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId))
      .limit(3);
    const token = signed.resumeToken;

    // ── PRIMER GUARDADO, para que la fila de respuestas EXISTA (es el estado de produccion) ──
    await writer.saveSurveyProgress({
      resumeToken: token,
      surveyVersionId: svId,
      answers: [{ questionId: qs[0].id, answerValue: "ya estaba" }],
      ipAddress: null,
    });
    const [resp] = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, signed.evaluationId));

    // ── EL INTERLEAVING, FORZADO ──
    //
    // `Promise.allSettled` de dos guardados NO reproduce la carrera, y eso hay que decirlo porque el
    // primer candado que escribimos pasaba sin el arreglo: cuando las filas YA existen, el `delete` de la
    // segunda transaccion se bloquea en los locks de fila de la primera y acaba ordenandose solo.
    //
    // EL 23505 SALE CUANDO LA FILA QUE SE VA A INSERTAR NO EXISTIA: las dos transacciones borran cero y
    // las dos insertan la misma `question_id`. Aqui se monta exactamente eso: una transaccion A inserta
    // la respuesta de `qs[1]` y SE QUEDA ABIERTA; el writer entra con un lote que incluye `qs[1]`, no
    // encuentra nada que borrar y va a insertarla.
    //
    // A TOMA EL MISMO CANDADO QUE TOMA EL WRITER (`for update` sobre la consulta), porque A ES el otro
    // writer: la pestana de la profesional o el telefono de la paciente entrando por el mismo token. Sin
    // esa linea el caso no prueba el arreglo, prueba otra cosa: lo escribimos primero sin ella y
    // reproducia el 23505 **con el arreglo puesto**, porque una escritura que NO pasa por el writer no
    // respeta su candado. Eso tambien es verdad y queda dicho: este arreglo serializa a los que entran
    // por `findAwaitingByToken`, que son los tres caminos de la encuesta (guardar, enviar y responder con
    // el paciente). Una escritura directa a `survey_answers` desde otro sitio volveria a poder chocar.
    //
    // CON EL `for update` el writer espera a A en su PRIMERA consulta y, cuando entra, ya ve la fila de A:
    // la borra y la reescribe. Sin el, llega al `insert` y muere con el 23505.
    let soltarA: () => void = () => {};
    const aInserto = new Promise<void>((resolve) => {
      soltarA = resolve;
    });
    let dejarCommitA: () => void = () => {};
    const puedeCommit = new Promise<void>((resolve) => {
      dejarCommitA = resolve;
    });
    const trabajoA = db.transaction(async (tx: any) => {
      await tx
        .select({ id: schema.evaluations.id })
        .from(schema.evaluations)
        .where(eq(schema.evaluations.id, signed.evaluationId))
        .for("update")
        .limit(1);
      await tx.insert(schema.surveyAnswers).values({
        responseId: resp.id,
        questionId: qs[1].id,
        answerValue: "de la otra pestana",
      });
      soltarA();
      await puedeCommit;
    });
    await aInserto;

    const trabajoWriter = writer.saveSurveyProgress({
      resumeToken: token,
      surveyVersionId: svId,
      answers: [
        { questionId: qs[0].id, answerValue: "del writer 0" },
        { questionId: qs[1].id, answerValue: "del writer 1" },
        { questionId: qs[2].id, answerValue: "del writer 2" },
      ],
      ipAddress: null,
    });
    // Se le da tiempo a que llegue a su primera consulta y se quede esperando el lock.
    await new Promise((r) => setTimeout(r, 150));
    dejarCommitA();
    await trabajoA;
    // NO FALLA. Antes del bloqueo, aqui saltaba el 23505 y se perdia el lote entero.
    await expect(trabajoWriter).resolves.toBeTruthy();

    // Y el snapshot queda ENTERO y es el del writer, que fue el ultimo.
    const progreso = await writer.getSurveyProgress(token);
    expect(progreso.answers).toHaveLength(3);
    const porPregunta = new Map(progreso.answers.map((a: any) => [a.questionId, a.answerValue]));
    expect(porPregunta.get(qs[1].id)).toBe("del writer 1");

    // UNA SOLA FILA DE RESPUESTAS POR CONSULTA. Es la otra mitad que el bloqueo cierra: sin el, dos
    // primeros guardados simultaneos creaban DOS `survey_responses` para la misma consulta, y el lector
    // se queda con una (o sea que la mitad de lo contestado desaparece de la pantalla sin ningun error).
    const filas = await db
      .select({ id: schema.surveyResponses.id })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, signed.evaluationId));
    expect(filas, "la consulta quedo con dos filas de respuestas").toHaveLength(1);
  });
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Y LA MISMA PREGUNTA DOS VECES EN UN LOTE NO TUMBA EL GUARDADO
  //
  // Hoy no puede pasar (`readAnswersFromForm` recorre las preguntas del instrumento, una entrada por
  // pregunta), pero un duplicado costaba el guardado COMPLETO: Postgres rechaza las 52, no la repetida.
  // La regla escrita es que gana la ULTIMA, y el writer lo reporta a Sentry con la clave.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("la misma pregunta dos veces en el mismo lote: gana la ULTIMA y no se pierde nada", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("dup"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);
    const qs = await db
      .select({ id: schema.surveyQuestions.id })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId))
      .limit(2);

    await writer.saveSurveyProgress({
      resumeToken: signed.resumeToken,
      surveyVersionId: svId,
      answers: [
        { questionId: qs[0].id, answerValue: "primera" },
        { questionId: qs[1].id, answerValue: "otra pregunta" },
        { questionId: qs[0].id, answerValue: "ULTIMA" },
      ],
      ipAddress: null,
    });

    const progreso = await writer.getSurveyProgress(signed.resumeToken);
    expect(progreso.answers, "se perdio la respuesta de la otra pregunta").toHaveLength(2);
    const porPregunta = new Map(progreso.answers.map((a: any) => [a.questionId, a.answerValue]));
    expect(porPregunta.get(qs[0].id)).toBe("ULTIMA");
    expect(porPregunta.get(qs[1].id)).toBe("otra pregunta");
  });
  it("el resume_token es de UN SOLO USO: un segundo envio con el mismo token falla (ya es 'draft')", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("c"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);

    await writer.completeSurvey({ resumeToken: signed.resumeToken, surveyVersionId: svId, answers: [], ipAddress: null });
    // Segundo intento: la evaluacion ya paso a 'draft', el token deja de habilitar.
    await expect(
      writer.completeSurvey({ resumeToken: signed.resumeToken, surveyVersionId: svId, answers: [], ipAddress: null }),
    ).rejects.toThrow(writer.ResumeTokenError);
  });

  it("GUARDAR PROGRESO queda en 'awaiting_survey' y el reemplazo con snapshot completo NO pierde nada", async () => {
    const signed = await writer.signIntakeEvaluation(signInput("e"));
    createdEvals.push(signed.evaluationId);
    createdPatients.push(signed.patientId);

    const qs = await db
      .select({ id: schema.surveyQuestions.id })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, svId))
      .limit(2);
    const token = signed.resumeToken;

    // Guarda el dominio 1 (una respuesta).
    await writer.saveSurveyProgress({ resumeToken: token, surveyVersionId: svId, answers: [{ questionId: qs[0].id, answerValue: "A" }], ipAddress: null });
    let [ev] = await db.select({ status: schema.evaluations.status }).from(schema.evaluations).where(eq(schema.evaluations.id, signed.evaluationId));
    expect(ev.status).toBe("awaiting_survey"); // guardar NO completa

    // Guarda el SNAPSHOT COMPLETO (dominio 1 + 2): reemplazar no pierde el dominio 1.
    await writer.saveSurveyProgress({ resumeToken: token, surveyVersionId: svId, answers: [{ questionId: qs[0].id, answerValue: "A" }, { questionId: qs[1].id, answerValue: "B" }], ipAddress: null });
    const progress = await writer.getSurveyProgress(token);
    expect(progress.answers).toHaveLength(2); // ambos dominios, ninguno perdido
    [ev] = await db.select({ status: schema.evaluations.status }).from(schema.evaluations).where(eq(schema.evaluations.id, signed.evaluationId));
    expect(ev.status).toBe("awaiting_survey"); // sigue esperando

    // Completar pasa a draft.
    await writer.completeSurvey({ resumeToken: token, surveyVersionId: svId, answers: [{ questionId: qs[0].id, answerValue: "A" }, { questionId: qs[1].id, answerValue: "B" }], ipAddress: null });
    [ev] = await db.select({ status: schema.evaluations.status }).from(schema.evaluations).where(eq(schema.evaluations.id, signed.evaluationId));
    expect(ev.status).toBe("draft");
  });

  it("SEGUIMIENTO re-firmado SIN cambios: AVANZA (crea el shell) y NO crea consentimiento nuevo (guard §3)", async () => {
    // 1. Inicial: crea el paciente + los consentimientos vigentes.
    const doc = `SPLIT-FUP-${Date.now()}`;
    const first = await writer.signIntakeEvaluation({
      ...signInput("fup", consents),
      identity: { ...identity("fup"), documentNumber: doc },
    });
    createdEvals.push(first.evaluationId);
    createdPatients.push(first.patientId);

    const activeBefore = await db
      .select({ id: schema.patientConsents.id })
      .from(schema.patientConsents)
      .where(eq(schema.patientConsents.patientId, first.patientId));
    const activeCountBefore = activeBefore.length;

    // LA PREPARACION SE CORRIGE, no la asercion (2026-09-08). Estos tests dejaban la inicial en
    // 'awaiting_survey' y pedian un seguimiento encima, que es EXACTAMENTE el caso que ahora se colapsa:
    // dos encuestas pendientes del mismo paciente y del mismo profesional ya no se crean, se retoma la
    // que hay. Un seguimiento real ocurre sobre una inicial ya respondida, asi que el montaje pasa a ser
    // el realista. Lo que cada test afirma (el guard de consentimiento §3 y el sellado de version) no
    // cambia ni una letra.
    await db
      .update(schema.evaluations)
      .set({ status: "draft" })
      .where(eq(schema.evaluations.id, first.evaluationId));

    // 2. Seguimiento re-firmado con los MISMOS consentimientos + mismo contacto: el guard NO debe crear
    //    consentimiento nuevo, pero SI debe crear el shell y devolver el resume_token (Santiago 2026-08-20:
    //    "que no cree nada no significa que no siga").
    const second = await writer.signIntakeEvaluation({
      ...signInput("fup", consents),
      mode: "seguimiento" as const,
      patientId: first.patientId,
      linkId: null,
      identity: { ...identity("fup"), documentNumber: doc },
    });
    createdEvals.push(second.evaluationId);

    // AVANZA: hay resume_token y el shell quedo en awaiting_survey.
    expect(second.resumeToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const [ev] = await db
      .select({ status: schema.evaluations.status, type: schema.evaluations.type })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, second.evaluationId));
    expect(ev.status).toBe("awaiting_survey");
    expect(ev.type).toBe("seguimiento");

    // NO se creo consentimiento nuevo: el conteo de filas de consent del paciente no aumento.
    const activeAfter = await db
      .select({ id: schema.patientConsents.id })
      .from(schema.patientConsents)
      .where(eq(schema.patientConsents.patientId, first.patientId));
    expect(activeAfter.length).toBe(activeCountBefore);

    // CONSTANCIA (dictamen §4): el paso deja rastro. Sin cambios -> consent.reconfirmed_no_change en
    // clinical_audit_log, entity_type='patient', entity_id=patientId. (Un re-consentimiento sin rastro es
    // peor que el boton roto, Santiago 2026-08-20.)
    const auditRows = await db
      .select({ event: schema.clinicalAuditLog.event })
      .from(schema.clinicalAuditLog)
      .where(eq(schema.clinicalAuditLog.entityId, first.patientId));
    const events = auditRows.map((r: { event: string }) => r.event);
    expect(events).toContain("consent.reconfirmed_no_change");
  });

  it("SEGUIMIENTO SIN FIRMA: sella consent_version en el eval + deja constancia (evaluation.followup_started)", async () => {
    // 1. Inicial: crea el paciente con consentimientos vigentes (version 1.7 en este fixture).
    const doc = `SPLIT-NOSIGN-${Date.now()}`;
    const first = await writer.signIntakeEvaluation({
      ...signInput("nosign", consents),
      identity: { ...identity("nosign"), documentNumber: doc },
    });
    createdEvals.push(first.evaluationId);
    createdPatients.push(first.patientId);

    // LA PREPARACION SE CORRIGE, no la asercion (2026-09-08). Estos tests dejaban la inicial en
    // 'awaiting_survey' y pedian un seguimiento encima, que es EXACTAMENTE el caso que ahora se colapsa:
    // dos encuestas pendientes del mismo paciente y del mismo profesional ya no se crean, se retoma la
    // que hay. Un seguimiento real ocurre sobre una inicial ya respondida, asi que el montaje pasa a ser
    // el realista. Lo que cada test afirma (el guard de consentimiento §3 y el sellado de version) no
    // cambia ni una letra.
    await db
      .update(schema.evaluations)
      .set({ status: "draft" })
      .where(eq(schema.evaluations.id, first.evaluationId));

    // 2. Seguimiento SIN firma: verifica la vigencia (gate) y crea el shell sin re-consentir.
    const started = await writer.startFollowupWithoutSignature({
      organizationId: orgId,
      professionalId: proId,
      patientId: first.patientId,
      linkId: null,
      ipAddress: null,
    });
    createdEvals.push(started.evaluationId);
    expect(started.resumeToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    // CONSTANCIA (dictamen §4) EN LA EVALUACION: consent_version sellada (la que el paciente TIENE) + marca de
    // tiempo (created_at) + el evento evaluation.followup_started (entity_type='evaluation'). No en el paciente.
    const [ev] = await db
      .select({
        status: schema.evaluations.status,
        type: schema.evaluations.type,
        consentVersion: schema.evaluations.consentVersion,
      })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, started.evaluationId));
    expect(ev.status).toBe("awaiting_survey");
    expect(ev.type).toBe("seguimiento");
    expect(ev.consentVersion).toBe("1.7"); // la version vigente del paciente, no la constante actual

    const audit = await db
      .select({ event: schema.clinicalAuditLog.event })
      .from(schema.clinicalAuditLog)
      .where(eq(schema.clinicalAuditLog.entityId, started.evaluationId));
    expect(audit.map((r: { event: string }) => r.event)).toContain("evaluation.followup_started");
  });

  it("el GATE (regla 15) sigue en la firma: sin las autorizaciones necesarias, no crea nada", async () => {
    const doc = `SPLIT-GATE-${Date.now()}`;
    const input = { ...signInput("d", [consents[0]]), identity: { ...identity("d"), documentNumber: doc } };
    // Solo una de las tres necesarias -> el gate rechaza.
    await expect(writer.signIntakeEvaluation(input)).rejects.toThrow(writer.ConsentGateError);
    // La transaccion revierte: el paciente que se inserto ANTES del gate no queda (chequeo especifico por
    // el documento, no un conteo global, que seria flaky bajo ejecucion paralela de otros tests).
    const rows = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(eq(schema.patients.documentNumber, doc));
    expect(rows).toHaveLength(0);
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
