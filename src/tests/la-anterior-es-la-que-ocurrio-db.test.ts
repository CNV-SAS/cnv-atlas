import { describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "LA ANTERIOR" ES LA ULTIMA QUE OCURRIO, NO LA ULTIMA CREADA  ·  EL CANDADO
//
// ═══ EL CASO, de Santiago (2026-11-09) ═══
//
// Cerro una consulta de seguimiento porque el paciente no vino, y emitio otro enlace de seguimiento: el
// S1 ya no aparecio. La consulta cerrada era la ultima CREADA, asi que se leia como "la anterior", y a
// una consulta a la que el paciente no vino no se le puede preguntar nada: no tiene respuestas que
// confirmar ni tratamiento del que medir la adherencia.
//
// ES LA TERCERA VEZ QUE ESTA MISMA ELECCION SALE MAL, y las tres por la misma forma: se escribio como
// "la ultima del paciente" con un filtro de menos. Primero faltaba excluir las reemplazadas y las
// retiradas; despues faltaba el techo temporal (elegia una POSTERIOR); ahora faltaba que hubiera
// ocurrido. Por eso el candado no mira un caso: mira la PROPIEDAD sobre todos los pacientes de la base,
// que es lo unico que atrapa el filtro que todavia no se nos ha ocurrido.
//
// ═══ Y MIRA LAS DOS MITADES, PORQUE SON DOS PREGUNTAS ═══
//
//   · la de LAS RESPUESTAS (la precarga del bloque de confirmacion y el salto digestivo): la ultima que
//     ocurrio, con ruta o sin ella;
//   · la de LOS PRODUCTOS (el S1 y el S2): la ultima que ocurrio Y TIENE TRATAMIENTO, porque la pregunta
//     es por la adherencia a una INDICACION.
//
// MEDIDO ANTES DE ARREGLARLO, para que el candado no sea decorativo: sobre los 31 pacientes de la nube
// con dos o mas consultas vigentes y sus 37 pares (consulta, su anterior), la regla de ayer elegia una
// consulta que NO ocurrio en 10 de los 37. O sea que esta propiedad FALLABA, y no por un borde.
//
// Se AUTO-SALTA sin DATABASE_URL. Requiere `supabase start`, migraciones aplicadas y el seed.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

// ── LA REGLA, SIN BASE ────────────────────────────────────────────────────────────────────────────
//
// La parte pura se comprueba aparte a proposito: un candado que solo mire el resultado de la consulta
// no distingue "la regla es correcta" de "los datos de hoy la cumplen por casualidad".
describe("la eleccion de las dos anteriores", () => {
  const cargar = async () => (await import("@/modules/evaluations/data/insumos-de-la-cnvs")).elegirLasAnteriores;

  it("sin candidatas, las dos quedan en null", async () => {
    const elegir = await cargar();
    expect(elegir([])).toEqual({ paraLasRespuestas: null, paraLosProductos: null });
  });

  it("si la mas reciente tiene tratamiento, las dos son ella", async () => {
    const elegir = await cargar();
    expect(
      elegir([
        { id: "a", tieneTratamiento: true },
        { id: "b", tieneTratamiento: true },
      ]),
    ).toEqual({ paraLasRespuestas: { id: "a" }, paraLosProductos: { id: "a" } });
  });

  // EL CASO QUE SEPARA LAS DOS MITADES: la consulta de la semana pasada ocurrio (el paciente respondio)
  // pero todavia no tiene ruta. Sus respuestas son las que hay que recordarle; la indicacion por la que
  // se le pregunta es la de la consulta anterior, que es la que sigue vigente.
  it("si la mas reciente no tiene tratamiento, los productos salen de la siguiente que si", async () => {
    const elegir = await cargar();
    expect(
      elegir([
        { id: "a", tieneTratamiento: false },
        { id: "b", tieneTratamiento: true },
        { id: "c", tieneTratamiento: true },
      ]),
    ).toEqual({ paraLasRespuestas: { id: "a" }, paraLosProductos: { id: "b" } });
  });

  // Y NO SE INVENTA UNA: sin ninguna con ruta, el S1 no se presenta, que es el caso normal (medido el
  // 2026-11-06: 18 de 30 pacientes con dos consultas no tienen ningun nutraceutico en la anterior).
  it("sin ninguna con tratamiento, los productos quedan en null y las respuestas no", async () => {
    const elegir = await cargar();
    expect(
      elegir([
        { id: "a", tieneTratamiento: false },
        { id: "b", tieneTratamiento: false },
      ]),
    ).toEqual({ paraLasRespuestas: { id: "a" }, paraLosProductos: null });
  });

  it("los dos estados que no ocurrieron no estan en la lista de los que si", async () => {
    const { ESTADOS_QUE_OCURRIERON } = await import("@/modules/evaluations/data/insumos-de-la-cnvs");
    expect([...ESTADOS_QUE_OCURRIERON].sort()).toEqual(["completed", "draft", "in_progress"]);
    expect(ESTADOS_QUE_OCURRIERON as readonly string[]).not.toContain("abandoned");
    expect(ESTADOS_QUE_OCURRIERON as readonly string[]).not.toContain("awaiting_survey");
  });
});

// ── LA PROPIEDAD, CONTRA LA BASE ──────────────────────────────────────────────────────────────────
let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la anterior que elige el lector, sobre todos los pacientes (BD real)", () => {
  const cargar = async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const mod = await import("@/modules/evaluations/data/insumos-de-la-cnvs");
    return { db, sql, mod };
  };

  it("ninguna anterior elegida es posterior, ni esta cerrada, ni espera encuesta", async () => {
    const { db, sql, mod } = await cargar();
    const filas = (await db.execute(sql`
      select e.id, e.patient_id, e.created_at, e.status
        from evaluations e
       where e.superseded_at is null and e.retirada_at is null
         and e.patient_id in (
           select patient_id from evaluations
            where superseded_at is null and retirada_at is null
            group by patient_id having count(*) > 1
         )
       order by e.patient_id, e.created_at
       limit 80
    `)) as unknown as { id: string; patient_id: string; created_at: string; status: string }[];
    expect(filas.length, "la base no tiene ningun paciente con dos consultas vigentes").toBeGreaterThan(1);

    let conAnterior = 0;
    for (const ev of filas) {
      const { paraLasRespuestas, paraLosProductos } = await mod.consultasAnterioresVigentes({
        patientId: ev.patient_id,
        excluyendo: ev.id,
      });
      for (const [cual, elegida] of [
        ["respuestas", paraLasRespuestas],
        ["productos", paraLosProductos],
      ] as const) {
        if (!elegida) continue;
        if (cual === "respuestas") conAnterior++;
        const [a] = (await db.execute(sql`
          select created_at, status, retirada_at, superseded_at
            from evaluations where id = ${elegida.id}::uuid`)) as unknown as {
          created_at: string;
          status: string;
          retirada_at: string | null;
          superseded_at: string | null;
        }[];
        // ANTERIOR EN EL TIEMPO (el defecto del 2026-11-09 por la mañana)
        expect(
          new Date(a.created_at).getTime(),
          `la anterior de ${cual} de ${ev.id} es POSTERIOR (${elegida.id})`,
        ).toBeLessThan(new Date(ev.created_at).getTime());
        // Y OCURRIO (el defecto del 2026-11-09 por la tarde)
        expect(
          [...mod.ESTADOS_QUE_OCURRIERON] as string[],
          `la anterior de ${cual} de ${ev.id} esta en "${a.status}", que no es una consulta que ocurrio`,
        ).toContain(a.status);
        expect(a.retirada_at, `la anterior de ${cual} de ${ev.id} esta retirada`).toBeNull();
        expect(a.superseded_at, `la anterior de ${cual} de ${ev.id} fue reemplazada`).toBeNull();
      }
      // Y LA DE LOS PRODUCTOS TIENE RUTA: es la mitad que arregla el S1 que no aparecia.
      if (paraLosProductos) {
        const [{ n }] = (await db.execute(sql`
          select count(*)::int as n
            from treatments t join diagnoses d on d.id = t.diagnosis_id
           where d.evaluation_id = ${paraLosProductos.id}::uuid`)) as unknown as { n: number }[];
        expect(n, `la anterior de productos de ${ev.id} no tiene tratamiento`).toBeGreaterThan(0);
      }
    }
    // Si NINGUN paciente de la base tuviera anterior, las aserciones de arriba no habrian corrido y el
    // caso pasaria vacio, que es peor que no tenerlo.
    expect(conAnterior, "ninguna consulta de la base tiene anterior: el caso paso vacio").toBeGreaterThan(0);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // EL CASO DE SANTIAGO, SEMBRADO  ·  y por que hace falta sembrarlo
  //
  // LA PROPIEDAD DE ARRIBA, SOLA, NO DISCRIMINA EN LOCAL. Medido: la base local tiene 16 pacientes con
  // dos o mas consultas vigentes y 18 pares, y en NINGUNO la regla vieja elegia una consulta que no
  // hubiera ocurrido. En la nube eran 10 de 37. O sea que el candado habria pasado verde con el defecto
  // dentro, que es justo lo que no puede hacer un candado.
  //
  // ASI QUE EL CASO SE SIEMBRA, con las tres consultas que lo hacen ambiguo:
  //
  //   · A, hace 60 dias, `completed`, CON ruta y un nutraceutico indicado;
  //   · B, hace 30 dias, `draft`: el paciente respondio y todavia no tiene ruta;
  //   · C, ayer, `abandoned`: la que Santiago cerro porque el paciente no vino.
  //
  // CON LA REGLA VIEJA las dos mitades salian de C, que no tiene nada: ni respuestas que confirmar ni
  // indicacion de la que medir adherencia, y el S1 desaparecia. Con la de hoy, las respuestas salen de
  // B y los productos de A.
  //
  // SE SIEMBRA Y SE BORRA (no en transaccion): el lector va por su propia conexion, asi que dentro de una
  // transaccion sin confirmar no veria nada de esto. El borrado va en `finally`.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("con una cerrada encima, la anterior sigue siendo la que ocurrio y la que tiene ruta", async () => {
    const { db, sql, mod } = await cargar();
    const ORG = "11111111-1111-1111-1111-111111111111";
    const PROF = "33333333-3333-3333-3333-333333333333";
    const MODELO = "44444444-4444-4444-4444-444444444444";
    const DOC = `CANDADO-ANTERIOR-${Date.now()}`;
    const NUTRA = `CANDADO-ANTERIOR-NUTRA-${Date.now()}`;
    let patientId = "";
    try {
      const [prof] = (await db.execute(sql`
        select profile_id from professional_profiles where id = ${PROF}::uuid`)) as unknown as {
        profile_id: string;
      }[];
      if (!prof) throw new Error("el seed no tiene el profesional de fixture: este caso no probo nada");

      const [paciente] = (await db.execute(sql`
        insert into patients (organization_id, document_type, document_number)
        values (${ORG}::uuid, 'CC', ${DOC}) returning id`)) as unknown as { id: string }[];
      patientId = paciente.id;

      const crear = async (tipo: string, estado: string, diasAtras: number) => {
        const [ev] = (await db.execute(sql`
          insert into evaluations (patient_id, professional_id, organization_id, type, status, created_at)
          values (${patientId}::uuid, ${PROF}::uuid, ${ORG}::uuid, ${tipo}, ${estado},
                  now() - (${diasAtras} || ' days')::interval)
          returning id`)) as unknown as { id: string }[];
        return ev.id;
      };
      const a = await crear("inicial", "completed", 60);
      const b = await crear("seguimiento", "draft", 30);
      const c = await crear("seguimiento", "abandoned", 1);

      // LA RUTA, SOLO EN A: es la que tiene la indicacion por la que el S1 pregunta.
      const [dx] = (await db.execute(sql`
        insert into diagnoses (evaluation_id, efr_state_number, diagnosis_name, engine_version,
                               model_version_id, rules_version)
        values (${a}::uuid, 1, 'Candado la anterior', 'stub', ${MODELO}::uuid, 'stub')
        returning id`)) as unknown as { id: string }[];
      const [tr] = (await db.execute(sql`
        insert into treatments (diagnosis_id, created_by)
        values (${dx.id}::uuid, ${prof.profile_id}::uuid) returning id`)) as unknown as { id: string }[];
      const [nt] = (await db.execute(sql`
        insert into nutraceuticals (organization_id, name, unit)
        values (${ORG}::uuid, ${NUTRA}, 'capsula') returning id`)) as unknown as { id: string }[];
      await db.execute(sql`
        insert into treatment_nutraceuticals (treatment_id, nutraceutical_id, dosage)
        values (${tr.id}::uuid, ${nt.id}::uuid, '1 al dia')`);

      // ── LA ELECCION ──
      const elegidas = await mod.consultasAnterioresVigentes({ patientId, excluyendo: null });
      expect(elegidas.paraLasRespuestas?.id, "las respuestas tienen que salir de B, la que ocurrio").toBe(b);
      expect(elegidas.paraLosProductos?.id, "los productos tienen que salir de A, la que tiene ruta").toBe(a);
      expect(elegidas.paraLasRespuestas?.id, "C esta cerrada: no es una consulta del paciente").not.toBe(c);
      expect(elegidas.paraLosProductos?.id, "C esta cerrada: no es una consulta del paciente").not.toBe(c);

      // ── Y EL S1 VUELVE A APARECER, que es el sintoma que reporto Santiago ──
      const insumos = await mod.insumosDeLaCnvs({ patientId, excluyendo: null });
      expect(insumos.productos.map((p: { nombre: string }) => p.nombre)).toEqual([NUTRA]);

      // ── CON LA CONSULTA DE HOY DELANTE, el techo temporal sigue en pie ──
      const desdeC = await mod.consultasAnterioresVigentes({ patientId, excluyendo: c });
      expect(desdeC.paraLasRespuestas?.id).toBe(b);
      const desdeB = await mod.consultasAnterioresVigentes({ patientId, excluyendo: b });
      expect(desdeB.paraLasRespuestas?.id, "desde B, la anterior es A y nunca C, que es POSTERIOR").toBe(a);
    } finally {
      if (patientId) {
        await db.execute(sql`
          delete from treatment_nutraceuticals tn using treatments t, diagnoses d, evaluations e
           where tn.treatment_id = t.id and t.diagnosis_id = d.id and d.evaluation_id = e.id
             and e.patient_id = ${patientId}::uuid`);
        await db.execute(sql`
          delete from treatments t using diagnoses d, evaluations e
           where t.diagnosis_id = d.id and d.evaluation_id = e.id and e.patient_id = ${patientId}::uuid`);
        await db.execute(sql`
          delete from diagnoses d using evaluations e
           where d.evaluation_id = e.id and e.patient_id = ${patientId}::uuid`);
        await db.execute(sql`delete from evaluations where patient_id = ${patientId}::uuid`);
        await db.execute(sql`delete from patients where id = ${patientId}::uuid`);
      }
      await db.execute(sql`delete from nutraceuticals where name = ${NUTRA}`);
    }
  }, 30000);
});
