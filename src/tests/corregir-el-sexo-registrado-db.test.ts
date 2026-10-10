import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CORREGIR UN SEXO YA REGISTRADO: PISA, PERO NUNCA EN SILENCIO (Santiago, 2026-10-10) ═══
//
// ── POR QUE ESTA PUERTA EXISTE, SI SU GEMELO DICE QUE NO SE PISA ───────────────────────────────────
//
// `completar-el-sexo-que-falta-db.test.ts` prueba lo contrario de esto, y los dos son correctos. Rellenar un
// hueco no puede equivocarse contra nada, así que su writer tiene el `where` que se lo impide. Pero cerrar
// solo eso dejaba un callejón al lado, y Santiago lo nombró con un caso real: *"un paciente por ejemplo
// transexual puede pensar que es el género, entonces el profesional debe poder cambiarlo."*
//
// El motor usa el sexo BIOLÓGICO (todas sus clasificaciones son sexo-específicas), así que un género anotado
// en ese campo no es un dato de identidad mal puesto: es un insumo clínico equivocado que produce
// clasificaciones equivocadas. Sin salida, era otro freno correcto que se vive como un sistema roto, que es
// el patrón que ya nos costó la capacitancia y la prescripción.
//
// ── POR QUE CONTRA LA BASE REAL Y NO CONTRA EL CODIGO ──────────────────────────────────────────────
//
// Porque las dos garantías que hacen que esto no sea peligroso las decide Postgres, no TypeScript:
//
//   · que el rastro guarde el valor ANTERIOR de verdad, leído con la fila bloqueada. Sin eso el rastro no
//     explica por qué el mismo paciente se clasificó de dos formas, que es lo único que después permite
//     entender dos diagnósticos que no coinciden;
//   · y que corregir al MISMO valor no escriba una segunda fila de rastro afirmando una corrección que no
//     cambió nada (el doble clic, o las dos pestañas abiertas).
//
// LO QUE NINGUNA DE LAS DOS FUNCIONES HACE es rehacer un diagnóstico ya generado. Eso solo pasa por el camino
// de corrección (`correctEvaluation`), que crea una versión nueva y marca la vieja como reemplazada.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("corregir el sexo de un paciente (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let completarSexoDelPaciente: any;
  let corregirSexoDelPaciente: any;
  let orgId: string;
  let actorId: string;
  const pacientes: string[] = [];

  const sexoDe = async (patientId: string): Promise<string | null> => {
    const [f] = await db.execute(
      dsql`select sex from patient_profiles where patient_id = ${patientId}`,
    );
    return f?.sex ?? null;
  };

  const nuevoPaciente = async (sex: string | null): Promise<string> => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`SEXOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    pacientes.push(p.id);
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, sex)
      values (${p.id}, 'Prueba', 'Correccion', ${sex})`);
    return p.id;
  };

  const correcciones = async (patientId: string): Promise<number> => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where entity_type = 'patient' and entity_id = ${patientId}
         and event = 'patient.sexo_corregido'`);
    return f.n;
  };

  const ultimaCorreccion = async (patientId: string): Promise<any> => {
    const [f] = await db.execute(dsql`
      select payload from clinical_audit_log
       where entity_type = 'patient' and entity_id = ${patientId}
         and event = 'patient.sexo_corregido'
       order by created_at desc limit 1`);
    return f?.payload ?? null;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ completarSexoDelPaciente, corregirSexoDelPaciente } = await import(
      "@/modules/patients/data/patient-sex-writer"
    ));
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
  const MOTIVO = "se registro el genero y el modelo clasifica con el sexo biologico";

  it("cambia un sexo ya registrado, y el rastro dice DE QUE a cual y por que", async () => {
    const p = await nuevoPaciente("M");
    const r = await corregirSexoDelPaciente({ patientId: p, sex: "F", motivo: MOTIVO }, actor());
    expect(r.estado).toBe("corregido");
    expect(await sexoDe(p)).toBe("F");
    const payload = await ultimaCorreccion(p);
    expect(
      payload,
      "una correccion sin rastro es un dato clinico que cambio y nadie sabe por que",
    ).not.toBeNull();
    expect(
      payload.sexoAnterior,
      "sin el valor anterior el rastro no explica por que dos diagnosticos del mismo paciente clasifican distinto",
    ).toBe("M");
    expect(payload.sexo).toBe("F");
    expect(payload.motivo).toBe(MOTIVO);
  });

  it("EL CASO QUE MAS IMPORTA: corregir al MISMO valor no escribe ni deja rastro", async () => {
    const p = await nuevoPaciente("F");
    const r = await corregirSexoDelPaciente({ patientId: p, sex: "F", motivo: MOTIVO }, actor());
    expect(
      r.estado,
      "decir 'corregido' aqui pondria en la historia clinica una correccion que no cambio nada",
    ).toBe("sin-cambio");
    expect(await sexoDe(p)).toBe("F");
    expect(
      await correcciones(p),
      "el doble clic, o dos pestanas abiertas, dejarian dos filas de rastro de una sola correccion",
    ).toBe(0);
  });

  it("y tambien sirve cuando el sexo FALTA: es el mismo acto por el otro lado", async () => {
    const p = await nuevoPaciente(null);
    const r = await corregirSexoDelPaciente({ patientId: p, sex: "M", motivo: MOTIVO }, actor());
    expect(r.estado).toBe("corregido");
    expect(await sexoDe(p)).toBe("M");
    const payload = await ultimaCorreccion(p);
    expect(payload.sexoAnterior, "estaba vacio, y el rastro tiene que decirlo tal cual").toBeNull();
  });

  it("completar DESPUES de corregir no pisa nada: cada funcion mantiene su frontera", async () => {
    const p = await nuevoPaciente(null);
    expect(await completarSexoDelPaciente({ patientId: p, sex: "F" }, actor())).toBe(true);
    // Y COMPLETAR YA NO PUEDE: el hueco esta tapado, asi que la unica via es corregir, con su motivo. Esta es
    // la frontera entera, vista de una: dos funciones sobre la misma columna que no se pisan.
    expect(await completarSexoDelPaciente({ patientId: p, sex: "M" }, actor())).toBe(false);
    expect(await sexoDe(p)).toBe("F");
    const r = await corregirSexoDelPaciente({ patientId: p, sex: "M", motivo: MOTIVO }, actor());
    expect(r.estado).toBe("corregido");
    expect(await sexoDe(p)).toBe("M");
  });

  it("y un paciente que no existe no escribe nada ni revienta", async () => {
    const inventado = "00000000-0000-4000-8000-000000000000";
    const r = await corregirSexoDelPaciente(
      { patientId: inventado, sex: "F", motivo: MOTIVO },
      actor(),
    );
    expect(r.estado).toBe("sin-cambio");
  });
});
