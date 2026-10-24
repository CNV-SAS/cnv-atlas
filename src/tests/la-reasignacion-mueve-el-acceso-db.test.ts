import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// ═══ REASIGNAR UN PACIENTE MUEVE EL ACCESO, Y LA FILA VIEJA SE QUEDA ═══
//
// ── QUE SE COMPRUEBA AQUI Y NO SE PUEDE COMPROBAR LEYENDO ────────────────────────────────────────
//
// Que `is_patient_of` deja de dar acceso cuando la relacion pasa a `reasignada`. Hasta la 0223 la funcion
// solo preguntaba por la EXISTENCIA de la fila, asi que poner la relacion en un estado historico NO quitaba
// el acceso: el profesional anterior seguia viendo la historia clinica completa de un paciente que ya no
// atiende. Eso es una afirmacion sobre la RLS, y la RLS solo se prueba corriendola.
//
// Y LA OTRA MITAD, que es la que hace la regla util: la fila vieja NO SE BORRA. Que ese profesional atendio
// a ese paciente es un hecho clinico que tiene que seguir en la base (Santiago, 2026-10-24), asi que el
// test exige las DOS cosas a la vez: sin acceso y con la fila presente.
//
// Simula los roles como PostgREST (set local role authenticated + request.jwt.claims), en una transaccion
// que se revierte. Requiere `supabase start`, migraciones aplicadas y el seed.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_R = "d0000000-0000-0000-0000-0000000000r1".replace("r", "a");
const EVAL_R = "d0000000-0000-0000-0000-0000000000e9";

let professionalId: string;
let professionalProfileId: string;

beforeAll(async () => {
  [{ id: professionalId }] = await sql`
    select p.id from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.name = 'professional' limit 1`;
  [{ id: professionalProfileId }] =
    await sql`select id from public.professional_profiles where profile_id = ${professionalId} limit 1`;

  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_R}, ${ORG_ID}, 'CC', 'REASIG-TEST-1') on conflict (id) do nothing`;
  await sql`insert into public.patient_profiles (patient_id, first_name, last_name, sex, birth_date)
    values (${PATIENT_R}, 'Prueba', 'Reasignacion', 'F', '1990-01-01')
    on conflict (patient_id) do nothing`;
  await sql`insert into public.patient_professional_relationships (patient_id, professional_id, status)
    values (${PATIENT_R}, ${professionalProfileId}, 'active')
    on conflict (patient_id, professional_id) do update set status = 'active'`;
  await sql`insert into public.evaluations (id, patient_id, professional_id, organization_id, type)
    values (${EVAL_R}, ${PATIENT_R}, ${professionalProfileId}, ${ORG_ID}, 'inicial')
    on conflict (id) do nothing`;
});

afterAll(async () => {
  await sql`delete from public.evaluations where id = ${EVAL_R}`;
  await sql`delete from public.patient_professional_relationships where patient_id = ${PATIENT_R}`;
  await sql`delete from public.patient_profiles where patient_id = ${PATIENT_R}`;
  await sql`delete from public.patients where id = ${PATIENT_R}`;
  await sql.end();
});

async function comoProfesional(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    const claims = JSON.stringify({ sub: professionalId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await fn(tx);
  });
}

describe("una relacion reasignada deja de dar acceso (0223)", () => {
  it("con la relacion ACTIVA, el profesional ve al paciente y su evaluacion", async () => {
    await comoProfesional(async (tx) => {
      const pac = await tx`select id from public.patients where id = ${PATIENT_R}`;
      expect(pac.length, "con la relacion activa tiene que verlo").toBe(1);
      const ev = await tx`select id from public.evaluations where id = ${EVAL_R}`;
      expect(ev.length).toBe(1);
      const perfil = await tx`select first_name from public.patient_profiles where patient_id = ${PATIENT_R}`;
      expect(perfil.length).toBe(1);
    });
  });

  it("con la relacion REASIGNADA, deja de verlo (paciente, perfil y evaluacion)", async () => {
    await sql.begin(async (tx) => {
      // El cambio de estado se hace como postgres (bypass RLS), igual que lo haria el writer con su
      // service role, y se revierte al final de la transaccion.
      await tx`update public.patient_professional_relationships set status = 'reasignada'
               where patient_id = ${PATIENT_R} and professional_id = ${professionalProfileId}`;
      await tx.unsafe("set local role authenticated");
      const claims = JSON.stringify({ sub: professionalId, role: "authenticated" });
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;

      const pac = await tx`select id from public.patients where id = ${PATIENT_R}`;
      expect(
        pac.length,
        "ESTE es el filo: antes de la 0223 is_patient_of solo miraba que la fila existiera, asi que un " +
          "profesional reasignado seguia viendo la historia clinica completa",
      ).toBe(0);
      const perfil = await tx`select first_name from public.patient_profiles where patient_id = ${PATIENT_R}`;
      expect(perfil.length, "el perfil lleva el nombre y la fecha de nacimiento: es PII").toBe(0);
      const ev = await tx`select id from public.evaluations where id = ${EVAL_R}`;
      expect(ev.length).toBe(0);

      // Y LA FUNCION, directamente, que es la unica definicion de la regla.
      const [{ es }] = await tx`select public.is_patient_professional(${PATIENT_R}) as es`;
      expect(es).toBe(false);

      throw new Error("ROLLBACK");
    }).catch((e: Error) => {
      if (e.message !== "ROLLBACK") throw e;
    });
  });

  it("y la fila NO se borra: el hecho de que la atendio sigue en la base", async () => {
    await sql.begin(async (tx) => {
      await tx`update public.patient_professional_relationships set status = 'reasignada'
               where patient_id = ${PATIENT_R} and professional_id = ${professionalProfileId}`;
      const filas = await tx`select status, assigned_at from public.patient_professional_relationships
                             where patient_id = ${PATIENT_R} and professional_id = ${professionalProfileId}`;
      expect(filas.length, "borrarla perderia el hecho clinico, que es lo que no se puede perder").toBe(1);
      expect(filas[0].status).toBe("reasignada");
      expect(filas[0].assigned_at, "la fecha original se conserva").not.toBeNull();
      throw new Error("ROLLBACK");
    }).catch((e: Error) => {
      if (e.message !== "ROLLBACK") throw e;
    });
  });

  it("el paciente PUEDE tener dos filas: la historica y la nueva activa", async () => {
    // La restriccion unica es (patient_id, professional_id), no (patient_id). Es lo que hace posible
    // conservar la historia sin bloquear la asignacion nueva.
    const [otro] = await sql`
      select pp.id from public.professional_profiles pp
      where pp.id <> ${professionalProfileId} limit 1`;
    if (!otro) return; // el seed solo trae un profesional: nada que comprobar aqui
    await sql.begin(async (tx) => {
      await tx`update public.patient_professional_relationships set status = 'reasignada'
               where patient_id = ${PATIENT_R} and professional_id = ${professionalProfileId}`;
      await tx`insert into public.patient_professional_relationships (patient_id, professional_id, status)
               values (${PATIENT_R}, ${otro.id}, 'active')
               on conflict (patient_id, professional_id) do update set status = 'active'`;
      const filas = await tx`select status from public.patient_professional_relationships
                             where patient_id = ${PATIENT_R} order by status`;
      expect(filas.map((f) => f.status)).toEqual(["active", "reasignada"]);
      throw new Error("ROLLBACK");
    }).catch((e: Error) => {
      if (e.message !== "ROLLBACK") throw e;
    });
  });

  it("el status no admite un valor que ningun camino escribe (CHECK de la 0223)", async () => {
    // Un `'Active'` con mayuscula, o un `'activa'` en espanol, dejaria al paciente invisible para su
    // propio profesional SIN UN SOLO ERROR. Por eso el vocabulario es cerrado.
    await expect(
      sql.begin(async (tx) => {
        await tx`update public.patient_professional_relationships set status = 'Active'
                 where patient_id = ${PATIENT_R}`;
      }),
    ).rejects.toThrow(/ppr_status_vocabulario|check constraint/i);
  });
});
