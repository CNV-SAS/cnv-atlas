import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// ═══ UN USUARIO CON DOS ROLES: CADA UNO ABRE LO SUYO, Y NADA MAS ═══
//
// ── DE DONDE SALE (Santiago, 2026-10-24) ─────────────────────────────────────────────────────────
//
// *"Gildardo queda con profesional y obbia a la vez. Asignale el rol obbia y verifica que con los dos no se
// le rompe nada: que ve lo suyo como profesional y lo de investigacion por la vista
// evaluaciones_para_investigacion, y que obbia no le abre historias que no son suyas."*
//
// ── POR QUE CONTRA LA BASE Y NO LEYENDO EL CODIGO ────────────────────────────────────────────────
//
// "El rol obbia no abre historias clinicas" es una afirmacion sobre la RLS, y la RLS solo se prueba
// corriendola. Leer las policies dice que `obbia` aparece unicamente en `research_datasets`; lo que no dice
// es que ninguna otra policy cambie de resultado cuando el MISMO usuario suma un rol, que es lo que
// preocupa: `has_role` pregunta por pertenencia, no por rol unico, y un `or` mal puesto en cualquier tabla
// convertiria un rol de investigacion en una llave clinica.
//
// Las dos mitades se prueban a la vez y con el mismo usuario: lo que ve con un rol, y lo que ve con dos.
//
// Simula los roles como PostgREST (set local role authenticated + request.jwt.claims), en una transaccion
// que se revierte. Requiere `supabase start`, migraciones aplicadas y el seed.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let usuarioId: string;
let obbiaRoleId: string;

beforeAll(async () => {
  // EL PROFESIONAL CON MAS PACIENTES, y no `limit 1` a secas (corregido el 2026-10-24).
  //
  // Decia `where r.name = 'professional' limit 1` SIN ORDEN, asi que Postgres devolvia el que quisiera, y
  // eso depende del estado fisico de la tabla: el dia que otra prueba movio filas, cayo en un profesional
  // con CERO pacientes y esta se cayo por su propio guard ("el seed tiene que darle al menos un
  // paciente"), no por una regresion de la RLS. Un `limit 1` sin `order by` es una cifra absoluta
  // disfrazada: envejece y falla por otra razon.
  //
  // Elegir al que MAS tiene es deterministico y es lo que la prueba necesita: comparar lo que ve con un
  // rol y con dos solo significa algo si ve algo.
  [{ id: usuarioId }] = await sql`
    select p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id
      join public.professional_profiles pp on pp.profile_id = p.id
      join public.patient_professional_relationships rel on rel.professional_id = pp.id
      join public.patients pa on pa.id = rel.patient_id
     where r.name = 'professional' and rel.status = 'active' and pa.deleted_at is null
     group by p.id
     order by count(*) desc, p.id
     limit 1`;
  [{ id: obbiaRoleId }] = await sql`select id from public.roles where name = 'obbia' limit 1`;
});

afterAll(async () => {
  await sql.end();
});

/** Corre `fn` como ese usuario, con los roles que tenga en ese momento, y revierte todo al salir. */
async function comoEseUsuario(
  fn: (tx: postgres.TransactionSql) => Promise<void>,
  preparar?: (tx: postgres.TransactionSql) => Promise<void>,
) {
  await sql
    .begin(async (tx) => {
      if (preparar) await preparar(tx);
      await tx.unsafe("set local role authenticated");
      const claims = JSON.stringify({ sub: usuarioId, role: "authenticated" });
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await fn(tx);
      throw new Error("ROLLBACK");
    })
    .catch((e: Error) => {
      if (e.message !== "ROLLBACK") throw e;
    });
}

const darleObbia = async (tx: postgres.TransactionSql) => {
  await tx`insert into public.user_roles (user_id, role_id) values (${usuarioId}, ${obbiaRoleId})
           on conflict do nothing`;
};

describe("sumar el rol obbia no abre ninguna puerta clinica", () => {
  it("ve exactamente los MISMOS pacientes con un rol y con dos", async () => {
    let conUnRol = -1;
    await comoEseUsuario(async (tx) => {
      const [{ n }] = await tx`select count(*)::int as n from public.patients`;
      conUnRol = n;
    });
    expect(conUnRol, "el seed tiene que darle al menos un paciente para que esto pruebe algo").toBeGreaterThan(0);

    let conDos = -1;
    await comoEseUsuario(
      async (tx) => {
        const [{ n }] = await tx`select count(*)::int as n from public.patients`;
        conDos = n;
      },
      darleObbia,
    );
    expect(conDos, "el rol de investigacion no puede sumar ni una historia clinica").toBe(conUnRol);
  });

  it("y los mismos perfiles, consentimientos, evaluaciones y mediciones", async () => {
    const contar = async (tx: postgres.TransactionSql) => {
      const [p] = await tx`select count(*)::int as n from public.patient_profiles`;
      const [c] = await tx`select count(*)::int as n from public.patient_consents`;
      const [e] = await tx`select count(*)::int as n from public.evaluations`;
      const [m] = await tx`select count(*)::int as n from public.bis_measurements`;
      return [p.n, c.n, e.n, m.n];
    };
    let antes: number[] = [];
    await comoEseUsuario(async (tx) => {
      antes = await contar(tx);
    });
    let despues: number[] = [];
    await comoEseUsuario(async (tx) => {
      despues = await contar(tx);
    }, darleObbia);
    expect(despues, "ninguna de las cuatro tablas con PII cambia de resultado").toEqual(antes);
  });

  it("sigue siendo profesional: los dos roles valen a la vez", async () => {
    await comoEseUsuario(
      async (tx) => {
        const [{ pro }] = await tx`select public.has_role('professional') as pro`;
        const [{ obb }] = await tx`select public.has_role('obbia') as obb`;
        expect(pro, "sumar un rol no puede quitar el que ya tenia").toBe(true);
        expect(obb).toBe(true);
      },
      darleObbia,
    );
  });

  it("lo que SI abre: research_datasets, que sin el rol no se ve", async () => {
    // Con una fila de verdad, no con una tabla vacia: contar cero en los dos lados no probaria nada.
    const crearDataset = async (tx: postgres.TransactionSql) => {
      await tx`insert into public.research_datasets (requested_by, scope, anonymization_level, status)
               values (${usuarioId}, 'prueba-dos-roles', 'aggregate', 'pending')`;
    };
    let sinObbia = -1;
    await comoEseUsuario(
      async (tx) => {
        const [{ n }] = await tx`select count(*)::int as n from public.research_datasets`;
        sinObbia = n;
      },
      crearDataset,
    );
    expect(sinObbia, "sin el rol, la fila existe y no se ve").toBe(0);

    let conObbia = -1;
    await comoEseUsuario(
      async (tx) => {
        const [{ n }] = await tx`select count(*)::int as n from public.research_datasets`;
        conObbia = n;
      },
      async (tx) => {
        await crearDataset(tx);
        await darleObbia(tx);
      },
    );
    expect(conObbia, "con el rol, la ve").toBe(1);
  });

  it("el nivel de anonimizacion es un vocabulario cerrado (0227)", async () => {
    // ANTES de la 0227 la columna era texto libre: un dataset podia quedar rotulado 'anonimizado',
    // 'anon' o vacio, y los tres se leerian igual de validos. Y el rotulo DECIDE cosas (un dataset
    // "anonymized" afirma que eso ya no es dato personal), asi que el vocabulario se cierra en la base y
    // no en un comentario del schema, que es donde estaba.
    const inventado = sql.begin(
      async (tx) =>
        await tx`insert into public.research_datasets (requested_by, scope, anonymization_level, status)
                 values (${usuarioId}, 'prueba-vocabulario', 'anonimizado', 'pending')`,
    );
    await expect(inventado).rejects.toThrow(/check constraint/i);

    // Y EL NIVEL QUE FALTABA, el que describe lo que CNV produce hoy, si entra. La transaccion revierte
    // sola al lanzar, asi que no deja la fila.
    const valido = sql.begin(async (tx) => {
      const filas = await tx`insert into public.research_datasets
                 (requested_by, scope, anonymization_level, status)
                 values (${usuarioId}, 'prueba-vocabulario', 'pseudonymized', 'pending')
                 returning id`;
      expect(filas.length, "seudonimizado es un nivel valido desde la 0227").toBe(1);
      throw new Error("revertir a proposito");
    });
    await expect(valido).rejects.toThrow("revertir a proposito");

    const [{ n }] = await sql`select count(*)::int as n from public.research_datasets
                              where scope = 'prueba-vocabulario'`;
    expect(n, "ninguna de las dos filas se queda").toBe(0);
  });

  it("las vistas de investigacion NO se leen con la sesion: estan revocadas a authenticated (0224)", async () => {
    // Y es a proposito: una vista abierta a `authenticated` seria una puerta alrededor de la RLS de
    // `evaluations`. El panel las lee como dueño, con la policy del servidor como unica autorizacion.
    await comoEseUsuario(
      async (tx) => {
        await expect(
          tx`select count(*) from public.evaluaciones_para_investigacion`,
        ).rejects.toThrow(/permission denied/i);
      },
      darleObbia,
    );
  });
});
