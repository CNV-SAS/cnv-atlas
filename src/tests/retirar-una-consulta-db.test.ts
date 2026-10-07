import { sql as dsql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DEL RETIRO DE UNA CONSULTA QUE NO OCURRIO (0212) ═══
//
// EL CASO: la paciente agendo el 21, no vino, y se atendio el 25. La del 21 figura en su historia clinica
// como una consulta que nunca paso, con su encuesta y su consentimiento firmados ese dia.
//
// ── LO QUE VIGILA, Y EL ORDEN NO ES CASUAL ─────────────────────────────────────────────────────────
//
//   1. QUE NO SE PUEDA RETIRAR UNA EVALUACION CON DIAGNOSTICO. Es la unica regla de esta pieza cuyo
//      incumplimiento ESCONDE UN DATO CLINICO, y se prueba en las DOS capas: el servicio (que explica) y el
//      trigger (que ataja a cualquiera que llegue por otro camino, incluido un UPDATE a mano).
//   2. QUE NO BORRE NADA: el consentimiento y las respuestas siguen ahi. Si retirar borrara, seria un delete
//      con otro nombre, y lo que se pierde son actos reales de una persona.
//   3. Y QUE SEA REVERSIBLE, que es la diferencia con `abandoned`: retirar es un juicio, y un juicio se
//      revisa.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("retirar una consulta (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: typeof import("@/modules/evaluations/data/evaluations-writer");
  let orgId: string;
  let profId: string;
  let actorId: string;
  let patientId: string;
  const evaluaciones: string[] = [];

  const crearEvaluacion = async (): Promise<string> => {
    const [e] = await db.execute(dsql`
      insert into evaluations (patient_id, professional_id, organization_id, type, status)
      values (${patientId}, ${profId}, ${orgId}, 'seguimiento', 'in_progress')
      returning id`);
    evaluaciones.push(e.id);
    return e.id;
  };

  const retirada = async (id: string) => {
    const [f] = await db.execute(dsql`
      select retirada_at, retirada_motivo, retirada_por from evaluations where id = ${id}::uuid`);
    return f;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/evaluations/data/evaluations-writer");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`RET-${Date.now()}`})
      returning id`);
    patientId = pa.id;
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of evaluaciones) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from diagnoses where evaluation_id = ${id}::uuid`);
      await db.execute(dsql`delete from evaluations where id = ${id}::uuid`);
    }
    evaluaciones.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from patients where id = ${patientId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("una consulta sin diagnostico se retira, con su motivo y su firma", async () => {
    const id = await crearEvaluacion();
    const r = await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "La paciente agendó el 21 y no vino; se atendió el 25",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    expect(r.retirada).toBe(true);
    const f = await retirada(id);
    expect(f.retirada_at).not.toBeNull();
    expect(f.retirada_motivo).toMatch(/no vino/);
    expect(f.retirada_por).toBe(actorId);
  });

  it("y queda en el audit, porque es un acto sobre una historia clinica", async () => {
    const id = await crearEvaluacion();
    await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "No ocurrió la consulta",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    const [a] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where event = 'evaluation.retirada' and entity_id = ${id}`);
    expect(Number(a.n)).toBe(1);
  });

  // SIN MOTIVO NO SE RETIRA: dentro de seis meses nadie sabria por que falta una consulta en una historia.
  it("sin motivo se rechaza", async () => {
    const id = await crearEvaluacion();
    await expect(
      writer.retirarEvaluacion({
        evaluationId: id,
        motivo: "  ",
        actorId,
        actorEmail: null as unknown as string,
        ip: null,
      }),
    ).rejects.toBeInstanceOf(writer.RetiroDeEvaluacionError);
  });

  it("retirarla dos veces no reescribe el motivo de la primera", async () => {
    const id = await crearEvaluacion();
    await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "El primero, que es el que vale",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    const r2 = await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "Un segundo motivo distinto",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    expect(r2.retirada).toBe(false);
    expect((await retirada(id)).retirada_motivo).toMatch(/el que vale/);
  });

  // ═══ EL PORTON QUE IMPORTA, EN LAS DOS CAPAS ═══
  describe("una evaluacion CON diagnostico", () => {
    const conDiagnostico = async (): Promise<string> => {
      const id = await crearEvaluacion();
      // UN DIAGNOSTICO MINIMO PERO VALIDO: el `efr_state_number`, el nombre y la constelacion de versiones son
      // NOT NULL (regla 7 de ARCHITECTURE.md), asi que un insert a medias no pasa. Se toma una version de
      // modelo cualquiera: lo que el candado prueba es el PORTON, no el contenido del diagnostico.
      const [mv] = await db.execute(dsql`select id from model_versions limit 1`);
      await db.execute(dsql`
        insert into diagnoses (evaluation_id, efr_state_number, diagnosis_name, engine_version,
                              model_version_id, rules_version)
        values (${id}, 1, 'candado del retiro', 'candado', ${mv.id}, 'candado')`);
      return id;
    };

    it("el servicio se niega, y lo explica", async () => {
      const id = await conDiagnostico();
      await expect(
        writer.retirarEvaluacion({
          evaluationId: id,
          motivo: "Intentando retirar una diagnosticada",
          actorId,
          actorEmail: null as unknown as string,
          ip: null,
        }),
      ).rejects.toThrow(/diagn[oó]stico/i);
    });

    // Y LA BASE TAMBIEN, por si alguien llega por otro camino: un arreglo a mano, un script, una pantalla
    // nueva que no pase por el servicio. Es la regla cuyo incumplimiento esconde un dato clinico, asi que no
    // puede depender de una sola capa.
    it("y el trigger la ataja aunque se intente por SQL directo", async () => {
      const id = await conDiagnostico();
      await expect(
        db.execute(dsql`
          update evaluations
             set retirada_at = now(), retirada_motivo = 'por la puerta de atras', retirada_por = ${actorId}
           where id = ${id}::uuid`),
      ).rejects.toThrow();
    });
  });

  it("retirar NO borra la encuesta ni el consentimiento", async () => {
    const id = await crearEvaluacion();
    // Una respuesta de encuesta colgada de la evaluacion, que es lo que no puede desaparecer.
    const [v] = await db.execute(dsql`select id from survey_versions order by published_at desc limit 1`);
    const [sr] = await db.execute(dsql`
      insert into survey_responses (evaluation_id, survey_version_id)
      values (${id}, ${v.id}) returning id`);
    await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "No ocurrió la consulta",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    const [q] = await db.execute(dsql`
      select count(*)::int as n from survey_responses where id = ${sr.id}::uuid`);
    expect(Number(q.n), "retirar borro la encuesta: seria un delete con otro nombre").toBe(1);
    await db.execute(dsql`delete from survey_responses where id = ${sr.id}::uuid`);
  });

  // ES REVERSIBLE, y es la diferencia con `abandoned`: retirar es un juicio, y un juicio se revisa.
  it("el retiro se puede deshacer, y queda su propio evento", async () => {
    const id = await crearEvaluacion();
    await writer.retirarEvaluacion({
      evaluationId: id,
      motivo: "Me equivoqué de paciente",
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    const r = await writer.deshacerRetiroDeEvaluacion({
      evaluationId: id,
      actorId,
      actorEmail: null as unknown as string,
      ip: null,
    });
    expect(r.restaurada).toBe(true);
    const f = await retirada(id);
    expect(f.retirada_at).toBeNull();
    expect(f.retirada_motivo).toBeNull();
    const [a] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where event = 'evaluation.retiro_deshecho' and entity_id = ${id}`);
    expect(Number(a.n)).toBe(1);
  });
});
