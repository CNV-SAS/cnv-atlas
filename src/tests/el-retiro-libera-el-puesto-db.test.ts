import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ RETIRAR LIBERA EL PUESTO, Y DESHACERLO LO DEVUELVE (Santiago, 2026-10-12) ═══
//
// EL PEDIDO: *"Si era 'Seguimiento 2', ese numero vuelve a estar libre. Si era la Inicial y habia una
// 'Seguimiento 1', esa pasa a ser la Inicial."* Su argumento es correcto: una consulta que no ocurrio no
// deberia consumir el puesto de la primera.
//
// ── POR QUE SOLO LA MITAD HIZO FALTA CONSTRUIR ────────────────────────────────────────────────────
//
// El NUMERO ya se renumeraba solo, porque no esta guardado: sale de contar las que estan en pie. El TIPO si
// esta en una columna, asi que al retirar la inicial el paciente se quedaba sin ninguna.
//
// ── POR QUE CONTRA LA BASE REAL, Y NO CONTRA EL CODIGO ────────────────────────────────────────────
//
// Porque lo que puede salir mal aqui no es una rama que no se tomo: es un ESTADO que queda mal y que no
// falla en ninguna parte. Las tres cosas que solo se ven mirando las filas:
//
//   · que al retirar la inicial, la siguiente EN FECHA pase a inicial (no una cualquiera);
//   · que al DESHACER el retiro, la ascendida vuelva a seguimiento. Sin eso el paciente queda con DOS
//     iniciales, la lista pinta dos "Inicial" y el numero del seguimiento cuenta desde el sitio
//     equivocado. Es la pieza fragil: nada falla, el estado solo se ve mirando;
//   · y que una candidata CON DIAGNOSTICO no se toque, porque ahi si habria algo sellado que contradecir
//     (un informe ya entregado que dice "Seguimiento 1", una fila de followup colgando de una inicial, y
//     una banda de trayectoria comparando contra la que se acaba de retirar).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el retiro libera el puesto de la inicial (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let retirarEvaluacion: any;
  let deshacerRetiroDeEvaluacion: any;
  let organizationId = "";
  let professionalId = "";
  let profileId = "";
  const pacientes: string[] = [];

  const MOTIVO = "agendo y no vino, se atendio otro dia";

  const nuevoPaciente = async (): Promise<string> => {
    const documento = `ZZ-RENUM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${organizationId}, 'CC', ${documento}) returning id`);
    pacientes.push(p.id);
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id)
      values (${p.id}, ${professionalId})`);
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, sex)
      values (${p.id}, 'ZZ', 'Renumera', 'F')`);
    return p.id;
  };

  /** Una consulta del paciente, con su tipo y su fecha (para que el orden sea el de la vida real). */
  const consulta = async (
    patientId: string,
    type: "inicial" | "seguimiento",
    diasAtras: number,
  ): Promise<string> => {
    const [e] = await db.execute(dsql`
      insert into evaluations (organization_id, patient_id, professional_id, type, status, created_at)
      values (${organizationId}, ${patientId}, ${professionalId}, ${type}, 'in_progress',
              now() - (${diasAtras} || ' days')::interval)
      returning id`);
    return e.id;
  };

  const tipoDe = async (evaluationId: string): Promise<string> => {
    const [e] = await db.execute(dsql`select type from evaluations where id = ${evaluationId}`);
    return e.type;
  };

  const traspasos = async (evaluationId: string): Promise<any[]> =>
    db.execute(dsql`
      select payload from clinical_audit_log
       where entity_type = 'evaluation' and entity_id = ${evaluationId}
         and event = 'evaluation.tipo_traspasado'
       order by created_at`);

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ retirarEvaluacion, deshacerRetiroDeEvaluacion } = await import(
      "@/modules/evaluations/data/evaluations-writer"
    ));
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    professionalId = prof.id;
    profileId = prof.profile_id;
    organizationId = prof.organization_id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    // `clinical_audit_log` es append-only por trigger, y debe serlo: es la bitacora clinica.
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of pacientes) {
      const evs = await db.execute(dsql`select id from evaluations where patient_id = ${id}`);
      for (const e of evs) {
        await db.execute(dsql`delete from clinical_audit_log where entity_id = ${e.id}`);
      }
      await db.execute(dsql`delete from evaluations where patient_id = ${id}`);
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  const actor = () => ({ actorId: profileId, actorEmail: "candado@cnv.test", ip: null });

  it("al retirar la inicial, la siguiente EN FECHA pasa a ser la inicial", async () => {
    const p = await nuevoPaciente();
    const inicial = await consulta(p, "inicial", 90);
    const seg1 = await consulta(p, "seguimiento", 60);
    const seg2 = await consulta(p, "seguimiento", 30);

    const r = await retirarEvaluacion({ evaluationId: inicial, motivo: MOTIVO, ...actor() });
    expect(r.retirada).toBe(true);

    expect(
      await tipoDe(seg1),
      "la que paso a primera es la mas ANTIGUA de las que quedan, no una cualquiera",
    ).toBe("inicial");
    expect(await tipoDe(seg2), "la segunda no se mueve: sigue siendo un seguimiento").toBe(
      "seguimiento",
    );

    const rastro = await traspasos(seg1);
    expect(
      rastro.length,
      "el tipo de una consulta es un dato de la historia clinica y acaba de cambiar sin que nadie lo escribiera",
    ).toBe(1);
    expect(rastro[0].payload.de).toBe("seguimiento");
    expect(rastro[0].payload.a).toBe("inicial");
    expect(rastro[0].payload.porElRetiroDe, "sin esto no se sabe por que cambio").toBe(inicial);
  }, 30_000);

  it("LA PIEZA FRAGIL: deshacer el retiro devuelve el puesto, y no quedan dos iniciales", async () => {
    const p = await nuevoPaciente();
    const inicial = await consulta(p, "inicial", 90);
    const seg1 = await consulta(p, "seguimiento", 60);

    await retirarEvaluacion({ evaluationId: inicial, motivo: MOTIVO, ...actor() });
    expect(await tipoDe(seg1)).toBe("inicial");

    const d = await deshacerRetiroDeEvaluacion({ evaluationId: inicial, ...actor() });
    expect(d.restaurada).toBe(true);

    expect(await tipoDe(inicial), "la que vuelve recupera su puesto").toBe("inicial");
    expect(
      await tipoDe(seg1),
      "sin la vuelta quedan DOS iniciales: la lista pinta dos 'Inicial' y el numero del seguimiento " +
        "cuenta desde el sitio equivocado, y nada falla en ninguna parte",
    ).toBe("seguimiento");

    const iniciales = await db.execute(dsql`
      select count(*)::int as n from evaluations
       where patient_id = ${p} and type = 'inicial' and retirada_at is null and superseded_at is null`);
    expect(iniciales[0].n, "un paciente en pie tiene exactamente una inicial").toBe(1);
  }, 30_000);

  it("y una candidata CON DIAGNOSTICO no se toca: ahi si hay algo sellado que contradecir", async () => {
    const p = await nuevoPaciente();
    const inicial = await consulta(p, "inicial", 90);
    const seg1 = await consulta(p, "seguimiento", 60);
    // Un diagnostico cualquiera sobre el seguimiento: lo que importa es que EXISTA la fila.
    const [modelo] = await db.execute(dsql`select id from model_versions order by created_at limit 1`);
    await db.execute(dsql`
      insert into diagnoses (evaluation_id, efr_state_number, diagnosis_name,
                             engine_version, model_version_id, rules_version)
      values (${seg1}, 1, 'ZZ candado', 'test', ${modelo.id}, 'test')`);

    await retirarEvaluacion({ evaluationId: inicial, motivo: MOTIVO, ...actor() });

    expect(
      await tipoDe(seg1),
      "un informe ya entregado dice 'Seguimiento 1' y su tipo se lee VIVO de la evaluacion: ascenderla " +
        "cambiaria el rotulo de un documento que el paciente ya tiene en la mano",
    ).toBe("seguimiento");
    expect((await traspasos(seg1)).length, "no hubo traspaso, asi que no hay rastro de uno").toBe(0);
  }, 30_000);

  it("y retirar un SEGUIMIENTO no mueve a nadie: su numero ya se renumera solo", async () => {
    const p = await nuevoPaciente();
    const inicial = await consulta(p, "inicial", 90);
    const seg1 = await consulta(p, "seguimiento", 60);
    const seg2 = await consulta(p, "seguimiento", 30);

    await retirarEvaluacion({ evaluationId: seg2, motivo: MOTIVO, ...actor() });

    expect(await tipoDe(inicial)).toBe("inicial");
    expect(await tipoDe(seg1)).toBe("seguimiento");
    expect((await traspasos(seg1)).length).toBe(0);
    expect((await traspasos(inicial)).length).toBe(0);
  }, 30_000);
});
