import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { and, eq, sql } from "drizzle-orm";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CASO 6 CONTRA LA BASE: CORREGIR SIN ARRASTRAR LA MEDICION
//
// ── POR QUE ESTA PRUEBA EXISTE Y NO BASTA EL CANDADO DE CODIGO ──────────────────────────────────
//
// `la-medicion-de-otro-paciente-se-desliga.test.ts` lee el codigo y defiende la FORMA (que la medicion
// no se copie, que el motor no corra, que la marca vaya en la misma transaccion). Aqui se comprueba el
// EFECTO, que es lo unico que no se puede afirmar leyendo:
//
//   · que el trigger de la 0030 marca la version vieja como reemplazada SIN que el servicio escriba
//     `superseded_at` a mano,
//   · que el CHECK y el write-once de la 0226 hacen lo que su comentario dice,
//   · y sobre todo LA MITAD QUE IMPORTA: que despues de corregir, el freno de la 0225 DEJA al dueno de
//     verdad importar su propia medicion. Antes de corregir, la bloquea. Esa es la razon de ser de la
//     marca, y es una afirmacion sobre dos piezas distintas hablandose: solo se prueba corriendola.
//
// Se AUTO-SALTA sin DATABASE_URL. Requiere `supabase start`, migraciones aplicadas y el seed.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la medicion era de otro paciente (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let s: any;
  let servicio: any;
  let freno: any;
  let huella: any;

  const SELLO = Date.now();
  let orgId: string;
  let profProfileId: string;
  let profProfileIdOtro: string | null = null;
  let actorId: string;
  let actorIdOtro: string | null = null;
  let condVersionId: string;
  let surveyVersionId: string;
  let preguntas: { id: string }[] = [];

  // A es el paciente en cuya historia quedo la medicion; B es el dueno de verdad.
  const A = { patientId: "", evaluationId: "" };
  const B = { patientId: "", evaluationId: "" };
  let measurementId = "";
  let nuevaEvaluacionId = "";
  let CRUDOS: { variableName: string; value: string }[] = [];

  async function crearPaciente(sufijo: string) {
    const [p] = await db
      .insert(s.patients)
      .values({
        organizationId: orgId,
        documentType: "CC",
        documentNumber: `CASO6-${SELLO}-${sufijo}`,
      })
      .returning({ id: s.patients.id });
    await db.insert(s.patientProfiles).values({
      patientId: p.id,
      firstName: "Caso",
      lastName: `Seis ${sufijo}`,
      sex: "F",
      birthDate: "1990-05-04",
    });
    await db
      .insert(s.patientProfessionalRelationships)
      .values({ patientId: p.id, professionalId: profProfileId, status: "active" });
    const [e] = await db
      .insert(s.evaluations)
      .values({
        patientId: p.id,
        professionalId: profProfileId,
        organizationId: orgId,
        type: "inicial",
        status: "in_progress",
      })
      .returning({ id: s.evaluations.id });
    return { patientId: p.id as string, evaluationId: e.id as string };
  }

  beforeAll(async () => {
    s = await import("@/db/schema");
    db = (await import("@/db")).db;
    servicio = await import("@/modules/corrections/services/corregir-medicion-de-otro-paciente");
    freno = await import("@/modules/bis/data/medicion-duplicada-reader");
    huella = await import("@/modules/bis/services/huella-de-la-medicion");

    orgId = (await db.select({ id: s.organizations.id }).from(s.organizations).limit(1))[0].id;
    const profs = await db
      .select({ id: s.professionalProfiles.id, profileId: s.professionalProfiles.profileId })
      .from(s.professionalProfiles)
      .limit(2);
    profProfileId = profs[0].id;
    actorId = profs[0].profileId;
    if (profs[1]) {
      profProfileIdOtro = profs[1].id;
      actorIdOtro = profs[1].profileId;
    }
    condVersionId = (
      await db.select({ id: s.bisConditionVersions.id }).from(s.bisConditionVersions).limit(1)
    )[0].id;
    surveyVersionId = (
      await db
        .select({ surveyVersionId: s.surveyResponses.surveyVersionId })
        .from(s.surveyResponses)
        .limit(1)
    )[0].surveyVersionId;
    preguntas = await db
      .select({ id: s.surveyQuestions.id })
      .from(s.surveyQuestions)
      .where(eq(s.surveyQuestions.surveyVersionId, surveyVersionId))
      .limit(3);

    Object.assign(A, await crearPaciente("A"));
    Object.assign(B, await crearPaciente("B"));

    // LA HUELLA ES PROPIA DE CADA CORRIDA, no una fija: dos corridas con las mismas cuatro lecturas
    // chocarian entre si, y la prueba fallaria por una razon que no es la que prueba. Es la leccion que
    // ya dejo el fixture del gate de importacion.
    CRUDOS = [
      { variableName: huella.VARIABLES_DE_LA_HUELLA[0], value: String(600 + (SELLO % 900) / 10) },
      { variableName: huella.VARIABLES_DE_LA_HUELLA[1], value: String(700 + (SELLO % 700) / 10) },
      { variableName: huella.VARIABLES_DE_LA_HUELLA[2], value: "420.7" },
      { variableName: huella.VARIABLES_DE_LA_HUELLA[3], value: String(2.5 + (SELLO % 400) / 10000) },
    ];

    const [med] = await db
      .insert(s.bisMeasurements)
      .values({ evaluationId: A.evaluationId, measurementDate: new Date("2026-10-13T14:00:00Z") })
      .returning({ id: s.bisMeasurements.id });
    measurementId = med.id;
    await db
      .insert(s.bisRawValues)
      .values(CRUDOS.map((c) => ({ measurementId: med.id, ...c })));
    await db.insert(s.evaluationBisIntake).values({
      evaluationId: A.evaluationId,
      bisConditionVersionId: condVersionId,
      conditionAnswers: { marcapasos: { value: true } },
      contraindicated: true,
      gripStrengthKg: "28.40",
      weightGoalKg: "62.00",
      weightGoalSetIn: "entrada",
      conditionsRegisteredAt: new Date(),
    });
    const [resp] = await db
      .insert(s.surveyResponses)
      .values({ evaluationId: A.evaluationId, surveyVersionId })
      .returning({ id: s.surveyResponses.id });
    await db.insert(s.surveyAnswers).values(
      preguntas.map((q, i) => ({ responseId: resp.id, questionId: q.id, answerValue: `v${i}` })),
    );
  });

  afterAll(async () => {
    if (!HAS_DB || !db) return;
    // `clinical_corrections` y `clinical_audit_log` son append-only POR TRIGGER, y la marca es
    // write-once: limpiar exige `replica` DENTRO de una transaccion (el pool reparte cada execute).
    const ids = [A.evaluationId, B.evaluationId, nuevaEvaluacionId].filter(Boolean);
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = 'replica'`);
      // LOS HIJOS SE BORRAN A MANO, Y NO ES REDUNDANTE: `replica` apaga TODOS los triggers, y en Postgres
      // las claves ajenas SON triggers, asi que el `on delete cascade` tampoco corre. Borrar solo la
      // evaluacion dejaba mediciones huerfanas en la base local, que es exactamente la clase de resto que
      // despues hace fallar otra prueba por una razon que no es la suya.
      for (const id of ids) {
        await tx.execute(sql`delete from clinical_audit_log where entity_id = ${id}`);
        await tx.execute(
          sql`delete from clinical_corrections where old_evaluation_id = ${id}::uuid or new_evaluation_id = ${id}::uuid`,
        );
        await tx.execute(
          sql`delete from bis_raw_values where measurement_id in (select id from bis_measurements where evaluation_id = ${id}::uuid)`,
        );
        await tx.execute(sql`delete from bis_measurements where evaluation_id = ${id}::uuid`);
        await tx.execute(sql`delete from evaluation_bis_intake where evaluation_id = ${id}::uuid`);
        await tx.execute(
          sql`delete from survey_answers where response_id in (select id from survey_responses where evaluation_id = ${id}::uuid)`,
        );
        await tx.execute(sql`delete from survey_responses where evaluation_id = ${id}::uuid`);
        await tx.execute(sql`delete from evaluations where id = ${id}::uuid`);
      }
      for (const pid of [A.patientId, B.patientId].filter(Boolean)) {
        await tx.execute(
          sql`delete from patient_professional_relationships where patient_id = ${pid}::uuid`,
        );
        await tx.execute(sql`delete from patient_profiles where patient_id = ${pid}::uuid`);
        await tx.execute(sql`delete from patients where id = ${pid}::uuid`);
      }
    });
  });

  it("ANTES de corregir, el freno bloquea al dueno de verdad", async () => {
    // Este es el defecto que la marca resuelve, y hay que verlo ocurrir para que la prueba signifique
    // algo: sin el "antes", el "despues" podria estar pasando por cualquier otra razon.
    const choque = await db.transaction((tx: any) =>
      freno.buscarLaMismaMedicion(tx, {
        evaluationId: B.evaluationId,
        patientId: B.patientId,
        valores: CRUDOS,
      }),
    );
    expect(choque, "la huella ya esta en la base, asi que el freno tiene que frenar").not.toBeNull();
    expect(choque.esDelMismoPaciente).toBe(false);
  });

  it("sin motivo no corrige, y no escribe nada", async () => {
    const r = await servicio.corregirMedicionDeOtroPaciente(
      { evaluationId: A.evaluationId, reason: "   ", confirmed: true },
      { actorId, actorEmail: "x@y.z", ip: null },
    );
    expect(r.ok).toBe(false);
    const [ev] = await db
      .select({ superseded: s.evaluations.supersededAt })
      .from(s.evaluations)
      .where(eq(s.evaluations.id, A.evaluationId));
    expect(ev.superseded).toBeNull();
  });

  it("sin confirmacion explicita tampoco", async () => {
    const r = await servicio.corregirMedicionDeOtroPaciente(
      { evaluationId: A.evaluationId, reason: "el archivo era del paciente B del mismo dia", confirmed: false },
      { actorId, actorEmail: "x@y.z", ip: null },
    );
    expect(r.ok).toBe(false);
  });

  it("otro profesional no puede desligar esta medicion (es un acto del asignado)", async () => {
    if (!actorIdOtro || profProfileIdOtro === profProfileId) return;
    const r = await servicio.corregirMedicionDeOtroPaciente(
      { evaluationId: A.evaluationId, reason: "el archivo era del paciente B del mismo dia", confirmed: true },
      { actorId: actorIdOtro, actorEmail: "x@y.z", ip: null },
    );
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("forbidden");
  });

  it("corrige: la vieja queda reemplazada y la nueva nace SIN medicion", async () => {
    const r = await servicio.corregirMedicionDeOtroPaciente(
      {
        evaluationId: A.evaluationId,
        reason: "el archivo importado era del paciente B, atendido el mismo dia; la edad del equipo no cuadra",
        confirmed: true,
      },
      { actorId, actorEmail: "prueba@cnv.test", ip: "127.0.0.1" },
    );
    expect(r.ok, r.ok ? "" : r.error?.message).toBe(true);
    nuevaEvaluacionId = r.value.newEvaluationId;

    const [vieja] = await db
      .select({ superseded: s.evaluations.supersededAt })
      .from(s.evaluations)
      .where(eq(s.evaluations.id, A.evaluationId));
    expect(vieja.superseded, "lo marca el trigger de la 0030, no el servicio").not.toBeNull();

    const [nueva] = await db
      .select({ status: s.evaluations.status, patientId: s.evaluations.patientId })
      .from(s.evaluations)
      .where(eq(s.evaluations.id, nuevaEvaluacionId));
    expect(nueva.status, "in_progress + sin BIS es lo que hace que su puerta diga Montar BIS").toBe(
      "in_progress",
    );
    expect(nueva.patientId).toBe(A.patientId);

    const medicionesDeLaNueva = await db
      .select({ id: s.bisMeasurements.id })
      .from(s.bisMeasurements)
      .where(eq(s.bisMeasurements.evaluationId, nuevaEvaluacionId));
    expect(medicionesDeLaNueva.length, "la toma no ocurrio en este paciente").toBe(0);
  });

  it("la medicion no se borro: sigue colgada de la version reemplazada, y marcada", async () => {
    const [m] = await db
      .select({
        at: s.bisMeasurements.noEsDelPacienteAt,
        por: s.bisMeasurements.noEsDelPacientePor,
        motivo: s.bisMeasurements.noEsDelPacienteMotivo,
        evaluationId: s.bisMeasurements.evaluationId,
      })
      .from(s.bisMeasurements)
      .where(eq(s.bisMeasurements.id, measurementId));
    expect(m, "nada se borra en una historia clinica").toBeDefined();
    expect(m.evaluationId).toBe(A.evaluationId);
    expect(m.at).not.toBeNull();
    expect(m.por).toBe(actorId);
    expect(m.motivo).toContain("paciente B");
  });

  it("la encuesta, la fuerza prensil y el peso meta viajaron; las condiciones quedaron pendientes", async () => {
    const [resp] = await db
      .select({ id: s.surveyResponses.id })
      .from(s.surveyResponses)
      .where(eq(s.surveyResponses.evaluationId, nuevaEvaluacionId));
    const ans = await db
      .select({ id: s.surveyAnswers.id })
      .from(s.surveyAnswers)
      .where(eq(s.surveyAnswers.responseId, resp.id));
    expect(ans.length, "las respuestas son del paciente: no es lo que estaba mal").toBe(preguntas.length);

    const [intake] = await db
      .select({
        grip: s.evaluationBisIntake.gripStrengthKg,
        meta: s.evaluationBisIntake.weightGoalKg,
        contra: s.evaluationBisIntake.contraindicated,
        registradas: s.evaluationBisIntake.conditionsRegisteredAt,
      })
      .from(s.evaluationBisIntake)
      .where(eq(s.evaluationBisIntake.evaluationId, nuevaEvaluacionId));
    expect(intake.grip, "la midio el profesional en ESTE paciente").toBe("28.40");
    expect(intake.meta).toBe("62.00");
    expect(intake.contra, "el marcapasos es del paciente: esa compuerta no se baja").toBe(true);
    expect(intake.registradas, "describen un momento que no era este: se piden de nuevo").toBeNull();
  });

  it("la cadena lleva el disparador PROPIO y su asiento de auditoria", async () => {
    const [corr] = await db
      .select({ trigger: s.clinicalCorrections.triggerType, reason: s.clinicalCorrections.reason })
      .from(s.clinicalCorrections)
      .where(eq(s.clinicalCorrections.newEvaluationId, nuevaEvaluacionId));
    expect(corr.trigger).toBe("medicion_de_otro_paciente");
    expect(corr.reason).toContain("paciente B");

    const audit = await db
      .select({ id: s.clinicalAuditLog.id })
      .from(s.clinicalAuditLog)
      .where(
        and(
          eq(s.clinicalAuditLog.entityId, nuevaEvaluacionId),
          eq(s.clinicalAuditLog.event, "evaluation.medicion_de_otro_paciente"),
        ),
      );
    expect(audit.length, "incidente de datos de salud: tiene que poder contarse aparte").toBe(1);
  });

  it("DESPUES de corregir, el dueno de verdad SI puede importar su medicion", async () => {
    const choque = await db.transaction((tx: any) =>
      freno.buscarLaMismaMedicion(tx, {
        evaluationId: B.evaluationId,
        patientId: B.patientId,
        valores: CRUDOS,
      }),
    );
    expect(choque, "esta es la razon de ser de la marca").toBeNull();
  });

  it("y no se abrio un agujero: una tercera importacion de la misma toma sigue frenando", async () => {
    const [medB] = await db
      .insert(s.bisMeasurements)
      .values({ evaluationId: B.evaluationId, measurementDate: new Date("2026-10-13T14:00:00Z") })
      .returning({ id: s.bisMeasurements.id });
    await db.insert(s.bisRawValues).values(CRUDOS.map((c) => ({ measurementId: medB.id, ...c })));

    const choque = await db.transaction((tx: any) =>
      freno.buscarLaMismaMedicion(tx, {
        evaluationId: nuevaEvaluacionId,
        patientId: A.patientId,
        valores: CRUDOS,
      }),
    );
    expect(choque, "ignorar la marca no es un permiso general para reimportar").not.toBeNull();
  });

  it("corregir dos veces la misma version no se puede: la cadena no se bifurca", async () => {
    const r = await servicio.corregirMedicionDeOtroPaciente(
      { evaluationId: A.evaluationId, reason: "intento de bifurcar la cadena de versiones", confirmed: true },
      { actorId, actorEmail: "x@y.z", ip: null },
    );
    expect(r.ok).toBe(false);
  });

  it("la marca es write-once y no admite medias marcas (0226)", async () => {
    await expect(
      db
        .update(s.bisMeasurements)
        .set({ noEsDelPacienteAt: null, noEsDelPacientePor: null, noEsDelPacienteMotivo: null })
        .where(eq(s.bisMeasurements.id, measurementId)),
    ).rejects.toThrow();

    const [medB] = await db
      .select({ id: s.bisMeasurements.id })
      .from(s.bisMeasurements)
      .where(eq(s.bisMeasurements.evaluationId, B.evaluationId))
      .limit(1);
    await expect(
      db
        .update(s.bisMeasurements)
        .set({ noEsDelPacienteAt: new Date() })
        .where(eq(s.bisMeasurements.id, medB.id)),
    ).rejects.toThrow();
  });
});
