import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE LA DERIVACION: UN PACIENTE DE UN PROFESIONAL DE PRUEBA CUENTA COMO DE PRUEBA (0202) ═══
//
// LO PIDIO SANTIAGO: que marcar al profesional arrastre a sus pacientes, sin escribir quince filas, y con
// una salida explicita por si alguno es real.
//
// POR QUE CONTRA LA BASE Y NO CONTRA EL CODIGO: la regla NO esta en TypeScript, esta en un trigger. Un test
// estatico solo podria comprobar que el trigger existe, y lo que importa es que RECALCULE en los tres
// momentos en que la respuesta cambia: al marcar al profesional, al asignarle un paciente, y al marcar o
// desmarcar al paciente.
//
// ── EL CASO QUE VALE MAS QUE TODOS ──
//
// UN PACIENTE CON DOS PROFESIONALES, UNO DE PRUEBA Y OTRO REAL, ES REAL. Si lo atiende alguien real, sus
// datos son reales: al contrario seria PERDER DATA CLINICA REAL por donde paso una prueba, y eso no se
// recupera con una migracion. Es la unica de estas reglas cuyo error cuesta data y no una cifra.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la derivacion de la marca de prueba (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let orgId: string;
  let profDePrueba: string;
  let profReal: string;
  const pacientes: string[] = [];
  let marcaOriginal: Record<string, boolean> = {};

  const marca = async (patientId: string) => {
    const [f] = await db.execute(dsql`
      select is_test, es_real_confirmado, cuenta_como_de_prueba from patients where id = ${patientId}`);
    return f;
  };

  const nuevoPaciente = async (): Promise<string> => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`DER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    pacientes.push(p.id);
    return p.id;
  };

  const asignar = async (patientId: string, professionalId: string) => {
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id, status)
      values (${patientId}, ${professionalId}, 'active')`);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    const [org] = await db.execute(dsql`select id from organizations limit 1`);
    orgId = org.id;
    // ── SE REUSAN DOS PROFESIONALES EXISTENTES, no se crean ──
    //
    // `profiles.id` no tiene default: espeja a `auth.users`, asi que un perfil no se puede inventar desde
    // aqui (lo intente y la base lo rechazo). Se toman dos, se recuerda su marca original y se devuelve al
    // final: un test que deja la base cambiada apagaria las cifras locales de alguien.
    // LOS QUE MENOS VENTAS TIENEN, no los mas antiguos: marcar a un profesional dispara el trigger de la 0203
    // sobre TODAS sus ventas, y el mas antiguo de la base local es el Demo con ~16.000. Es la cuarta copia de
    // esta consulta y la ultima que quedaba sin el orden bueno; el candado `fixture-no-coge-al-demo` lo vigila.
    const profs = await db.execute(dsql`
      select id, coalesce(is_test, false) as is_test
        from professional_profiles pp
       order by (select count(*) from transactions t where t.professional_id = pp.id), created_at
       limit 2`);
    if (profs.length < 2) throw new Error("hacen falta dos professional_profiles para este candado");
    profDePrueba = profs[0].id;
    profReal = profs[1].id;
    marcaOriginal = { [profs[0].id]: profs[0].is_test, [profs[1].id]: profs[1].is_test };
    await db.execute(dsql`update professional_profiles set is_test = true where id = ${profDePrueba}`);
    await db.execute(dsql`update professional_profiles set is_test = false where id = ${profReal}`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of pacientes) {
      await db.execute(dsql`delete from patient_professional_relationships where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    // LA MARCA VUELVE A COMO ESTABA, y es lo que hace que el fixture no deje rastro: la derivacion de sus
    // pacientes se recalcula sola al devolverla, por el mismo trigger que se esta probando.
    for (const [id, valor] of Object.entries(marcaOriginal)) {
      await db.execute(dsql`update professional_profiles set is_test = ${valor} where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("asignarle un paciente a un profesional de prueba lo deriva, sin marcarlo a mano", async () => {
    const p = await nuevoPaciente();
    // SIN RELACIONES NO SE DERIVA: no hay de quien deducirlo.
    expect((await marca(p)).cuenta_como_de_prueba).toBe(false);
    await asignar(p, profDePrueba);
    const m = await marca(p);
    expect(m.cuenta_como_de_prueba, "la derivacion no corrio al asignarlo").toBe(true);
    // Y LA DECISION EXPLICITA SIGUE EN FALSO: nadie lo marco, se dedujo. La distincion importa porque
    // desmarcar al profesional tiene que devolverlo, y eso solo funciona si no se escribio su marca.
    expect(m.is_test).toBe(false);
  });

  it("EL CASO QUE MAS IMPORTA: si tambien lo atiende alguien real, es real", async () => {
    const p = await nuevoPaciente();
    await asignar(p, profDePrueba);
    expect((await marca(p)).cuenta_como_de_prueba).toBe(true);
    await asignar(p, profReal);
    expect(
      (await marca(p)).cuenta_como_de_prueba,
      "un paciente atendido por un profesional real quedo contado como de prueba: eso PIERDE data clinica real",
    ).toBe(false);
  });

  it("marcar al profesional arrastra a los pacientes que ya tenia", async () => {
    const p = await nuevoPaciente();
    await asignar(p, profReal);
    expect((await marca(p)).cuenta_como_de_prueba).toBe(false);
    try {
      await db.execute(dsql`update professional_profiles set is_test = true where id = ${profReal}`);
      expect(
        (await marca(p)).cuenta_como_de_prueba,
        "marcar al profesional no recalculo a sus pacientes, que es justo lo que se pidio",
      ).toBe(true);
    } finally {
      await db.execute(dsql`update professional_profiles set is_test = false where id = ${profReal}`);
    }
    // Y AL DESMARCARLO VUELVE, que es lo que hace reversible la derivacion.
    expect((await marca(p)).cuenta_como_de_prueba).toBe(false);
  });

  it("y la salida explicita gana a la derivacion", async () => {
    const p = await nuevoPaciente();
    await asignar(p, profDePrueba);
    expect((await marca(p)).cuenta_como_de_prueba).toBe(true);
    await db.execute(dsql`update patients set es_real_confirmado = true where id = ${p}`);
    expect(
      (await marca(p)).cuenta_como_de_prueba,
      "la salida explicita no se respeta, asi que un paciente real de una cuenta de prueba no tiene rescate",
    ).toBe(false);
  });

  it("las dos marcas explicitas no pueden convivir", async () => {
    const p = await nuevoPaciente();
    await db.execute(dsql`update patients set es_real_confirmado = true where id = ${p}`);
    // "Es de prueba" y "es real" son la misma decision en sentidos opuestos: juntas obligarian a inventar
    // cual gana, y el CHECK lo impide en la base en vez de en una validacion que alguien puede saltarse.
    await expect(
      db.execute(dsql`update patients set is_test = true where id = ${p}`),
    ).rejects.toThrow();
  });
});
