import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ COMPLETAR EL SEXO QUE FALTA: RELLENA UN HUECO Y NUNCA PISA UN VALOR (Sentry, 2026-10-10) ═══
//
// ── POR QUE CONTRA LA BASE REAL Y NO CONTRA EL CODIGO ──────────────────────────────────────────────
//
// Porque la frontera NO es una comprobacion en TypeScript: es el `where` del propio `update`. Un test
// estatico solo puede ver que la condicion esta escrita; lo que hay que probar es que la escritura NO
// OCURRE cuando ya hay un sexo, y eso lo decide Postgres.
//
// Y LA DISTINCION IMPORTA DE VERDAD: cambiar el sexo de un paciente con diagnostico SELLADO invalidaria
// el sellado, y un sellado no se recalcula. Por eso la pantalla solo puede rellenar, y por eso el
// segundo intento tiene que devolver `false` en vez de "guardado" sobre algo que no se guardo.
//
// SE PRUEBAN LAS DOS FORMAS DE VACIO (nulo y en blanco) porque las dos existen en la base: el import del
// HTML dejo nulos, y el intake viejo de texto libre pudo dejar blancos. Mirar solo `is null` dejaria al
// segundo sin arreglo posible y la pantalla diria "guardado" sin haber guardado nada.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("completar el sexo de un paciente (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let completarSexoDelPaciente: any;
  let orgId: string;
  let actorId: string;
  const pacientes: string[] = [];

  const sexoDe = async (patientId: string): Promise<string | null> => {
    const [f] = await db.execute(
      dsql`select sex from patient_profiles where patient_id = ${patientId}`,
    );
    return f?.sex ?? null;
  };

  /** Un paciente nuevo con su perfil, con el sexo que se le pida (nulo o en blanco). */
  const nuevoPaciente = async (sex: string | null): Promise<string> => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`SEXO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    pacientes.push(p.id);
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, sex)
      values (${p.id}, 'Prueba', 'Candado', ${sex})`);
    return p.id;
  };

  const auditos = async (patientId: string): Promise<number> => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where entity_type = 'patient' and entity_id = ${patientId}
         and event = 'patient.sexo_completado'`);
    return f.n;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ completarSexoDelPaciente } = await import("@/modules/patients/data/patient-sex-writer"));
    const [org] = await db.execute(dsql`select id from organizations limit 1`);
    orgId = org.id;
    // UN ACTOR REAL: `clinical_audit_log.actor_id` apunta a `profiles`, asi que no se puede inventar.
    const [prof] = await db.execute(dsql`select id from profiles order by created_at limit 1`);
    actorId = prof.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of pacientes) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  const actor = () => ({ actorId, actorEmail: "candado@cnv.test", ip: null });

  it("con el sexo NULO lo escribe, y deja su rastro clinico", async () => {
    const p = await nuevoPaciente(null);
    const escrito = await completarSexoDelPaciente({ patientId: p, sex: "F" }, actor());
    expect(escrito, "este es el caso de la paciente del import del HTML").toBe(true);
    expect(await sexoDe(p)).toBe("F");
    expect(
      await auditos(p),
      "el sexo decide TODAS las clasificaciones del motor: quien lo registro es parte de la historia",
    ).toBe(1);
  });

  it("con el sexo EN BLANCO tambien, que es la otra forma de que falte", async () => {
    const p = await nuevoPaciente("   ");
    expect(await completarSexoDelPaciente({ patientId: p, sex: "M" }, actor())).toBe(true);
    expect(await sexoDe(p)).toBe("M");
  });

  it("EL CASO QUE MAS IMPORTA: con un sexo ya registrado NO lo pisa, y lo dice", async () => {
    const p = await nuevoPaciente(null);
    expect(await completarSexoDelPaciente({ patientId: p, sex: "F" }, actor())).toBe(true);
    const segunda = await completarSexoDelPaciente({ patientId: p, sex: "M" }, actor());
    expect(
      segunda,
      "devolver true aqui haria que la pantalla dijera 'guardado' sobre algo que no se guardo",
    ).toBe(false);
    expect(
      await sexoDe(p),
      "se piso el sexo de un paciente: si tuviera diagnostico sellado, el sellado quedaria mintiendo",
    ).toBe("F");
    expect(await auditos(p), "un intento que no escribio nada no deja rastro de escritura").toBe(1);
  });

  it("y un paciente que no existe no escribe nada ni revienta", async () => {
    const inventado = "00000000-0000-4000-8000-000000000000";
    expect(await completarSexoDelPaciente({ patientId: inventado, sex: "F" }, actor())).toBe(false);
  });
});
