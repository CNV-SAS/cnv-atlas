import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql as dsql } from "drizzle-orm";
import postgres from "postgres";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUITARLE EL ACCESO A UN INTEGRANTE, CONTRA LA BASE  ·  0229
//
// ── POR QUE CONTRA LA BASE Y NO LEYENDO EL CODIGO ───────────────────────────────────────────────
//
// Gildardo pidio un boton "que le quite el acceso, reversible, con motivo y auditoria", y en la misma
// frase las preguntas que de verdad deciden si esto sirve: *"que pasa con el inicio de sesion y una sesion
// ya abierta; sus pacientes; sus enlaces; sus comisiones."*
//
// NINGUNA DE ESAS SE PUEDE CONTESTAR LEYENDO. "No ve ninguna historia clinica" es una afirmacion sobre la
// RLS, y la RLS solo se prueba corriendola: hasta la 0229 ninguna policy miraba `profiles.status`, asi que
// `requireUser()` lo echaba de las PANTALLAS y la API seguia abierta con su token todavia vivo. Esta prueba
// mide las dos mitades y la vuelta atras, con el mismo usuario:
//
//   · lo que ve ACTIVO, lo que ve INACTIVO, y lo que vuelve a ver REACTIVADO;
//   · que sus pacientes, su margen y sus enlaces NO se mueven (quitar el acceso no es cerrar una cuenta);
//   · y que el CHECK de la 0229 no deja un inactivo sin motivo, que es la mitad de la peticion.
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

describe.skipIf(!HAS_DB)("el acceso de un integrante (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: any;
  let lector: any;
  let raw: postgres.Sql;

  const SELLO = Date.now();
  let orgId = "";
  let usuarioId = "";
  let profProfileId = "";
  let adminId = "";
  let pacienteId = "";
  let creado = false;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    writer = await import("@/modules/professionals/data/acceso-del-integrante-writer");
    lector = await import("@/modules/professionals/data/lo-que-queda-abierto");
    raw = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

    // ═══ UN USUARIO DESECHABLE, CREADO PARA ESTA PRUEBA ═══
    //
    // LA PRIMERA VERSION TOMABA "el primer perfil sin perfil profesional" DEL SEED, y cayo en la cuenta de
    // admin de Santiago: la prueba la habria inactivado y la habria BLOQUEADO en el servicio de sesion.
    // Ademas, al buscar un admin "distinto del sujeto" no encontraba ninguno (era el unico), asi que tres
    // pruebas se saltaban SOLAS y pasaban en verde sin probar nada. Un `return` silencioso dentro de un
    // `it` es un falso verde: es la misma familia que un `limit 1` sin `order by`.
    //
    // Por eso el sujeto se CREA: `profiles.id` espeja `auth.users` y el perfil lo pone un trigger a partir
    // de los metadatos, asi que se crea por la API de admin, igual que el seed.
    const [org] = await db.execute(dsql`select id from organizations order by created_at limit 1`);
    orgId = org?.id ?? "";

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const creadoAuth = await admin.auth.admin.createUser({
      email: `acceso-${SELLO}@prueba.local`,
      password: `Pr#${SELLO}aA1`,
      email_confirm: true,
      user_metadata: { organization_id: orgId, full_name: "Integrante Desechable" },
    });
    if (creadoAuth.error || !creadoAuth.data.user) return;
    usuarioId = creadoAuth.data.user.id;

    // El ACTOR es un admin de verdad, cualquiera: el sujeto es desechable, asi que ya no hay que excluirlo.
    const [elAdmin] = await db.execute(dsql`
      select p.id from profiles p
       join user_roles ur on ur.user_id = p.id
       join roles r on r.id = ur.role_id
      where r.name = 'admin'
      order by p.id
      limit 1`);
    adminId = elAdmin?.id ?? "";
    expect(adminId, "el seed tiene que tener un admin para que esta prueba pruebe algo").not.toBe("");

    const [pp] = await db.execute(dsql`
      insert into professional_profiles (profile_id, profession)
      values (${usuarioId}::uuid, 'nutricionista')
      returning id`);
    profProfileId = pp.id;

    // Un rol de profesional para el, y un paciente suyo: sin paciente, "no ve ninguna historia" pasaria
    // verde tambien con la RLS rota, porque no habria nada que ver.
    await db.execute(dsql`
      insert into user_roles (user_id, role_id)
      select ${usuarioId}::uuid, r.id from roles r where r.name = 'professional'
      on conflict do nothing`);

    const [pac] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}::uuid, 'CC', ${`ACCESO-${SELLO}`})
      returning id`);
    pacienteId = pac.id;
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, sex, birth_date)
      values (${pacienteId}::uuid, 'Acceso', 'De Prueba', 'F', '1990-01-01')`);
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id, status)
      values (${pacienteId}::uuid, ${profProfileId}::uuid, 'active')`);
    creado = true;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    if (creado) {
      // `replica` apaga TODOS los triggers, y en Postgres las claves ajenas SON triggers, asi que el
      // `on delete cascade` tampoco corre: los hijos se borran a mano o quedan huerfanos y revientan OTRA
      // prueba. Y el perfil vuelve a 'active' con las tres columnas limpias, o el CHECK de la 0229 dejaria
      // la base en un estado que ninguna pantalla sabe leer.
      await db.execute(dsql`set session_replication_role = replica`);
      await db.execute(dsql`delete from patient_professional_relationships where patient_id = ${pacienteId}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${pacienteId}`);
      await db.execute(dsql`delete from patients where id = ${pacienteId}`);
      await db.execute(dsql`delete from inventory_locations where professional_id = ${profProfileId}`);
      await db.execute(dsql`delete from professional_profiles where id = ${profProfileId}`);
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${usuarioId}`);
      await db.execute(dsql`delete from user_roles where user_id = ${usuarioId}::uuid`);
      await db.execute(dsql`set session_replication_role = default`);
      // EL USUARIO DESECHABLE SE BORRA DE AUTH, y con el cae su perfil por el cascade del espejo. Si se
      // quedara, la proxima corrida tendria un integrante inactivo y bloqueado en la base local, y
      // "quien es ese" se investiga como si fuera un hallazgo.
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      await createSupabaseAdminClient().auth.admin.deleteUser(usuarioId);
    }
    await raw?.end();
  });

  /**
   * EL FIXTURE O NO HAY PRUEBA. Antes cada caso empezaba con un `if (!creado) return;`, y eso es un falso
   * verde: el 2026-10-25 tres pruebas se saltaron solas (no habia un admin distinto del sujeto) y el
   * archivo salio en verde sin haber ejercido el acto. Un guard que SALTA se lee igual que uno que PASA.
   */
  function exigirFixture() {
    expect(creado, "el fixture de la prueba no se pudo armar: nada de lo de abajo probo nada").toBe(true);
    expect(adminId, "hace falta un admin como actor").not.toBe("");
  }

  /** Cuenta lo que ese usuario ve de `tabla` con su sesion, bajo RLS, en una transaccion que se revierte. */
  async function loQueVe(tabla: string): Promise<number> {
    let n = -1;
    await raw
      .begin(async (tx) => {
        await tx.unsafe("set local role authenticated");
        const claims = JSON.stringify({ sub: usuarioId, role: "authenticated" });
        await tx`select set_config('request.jwt.claims', ${claims}, true)`;
        const [fila] = await tx.unsafe(`select count(*)::int as n from public.${tabla}`);
        n = fila.n;
        throw new Error("ROLLBACK");
      })
      .catch((e: Error) => {
        if (e.message !== "ROLLBACK") throw e;
      });
    return n;
  }

  /** El mensaje REAL de Postgres de una consulta que debe fallar. Vacio si no fallo. */
  async function causaDe(consulta: ReturnType<typeof dsql>): Promise<string> {
    try {
      await db.execute(consulta);
      return "";
    } catch (e) {
      const err = e as Error & { cause?: Error };
      return `${err.message} ${err.cause?.message ?? ""}`;
    }
  }

  async function estado() {
    const [fila] = await db.execute(dsql`
      select status::text as status, inactivo_desde::text as desde, inactivacion_motivo as motivo,
             inactivado_por::text as por
        from profiles where id = ${usuarioId}`);
    return fila;
  }

  it("el CHECK de la 0229 no deja un inactivo SIN motivo", async () => {
    exigirFixture();
    // ES LA MITAD DE LA PETICION ("con motivo"), y hasta hoy el unico camino era un UPDATE a mano que
    // ponia `status` y nada mas. Si el CHECK no existe, el boton puede pedir motivo y el UPDATE de al lado
    // no, y entonces "siempre hay motivo" es una costumbre, no una garantia.
    // DRIZZLE ENVUELVE EL ERROR DE POSTGRES: su `message` es "Failed query: ..." y el del CHECK viaja en la
    // CAUSA. Comparar contra el mensaje de arriba daba un fallo que parecia decir que el CHECK no existe.
    expect(await causaDe(dsql`update profiles set status = 'inactive' where id = ${usuarioId}`)).toMatch(
      /profiles_inactivacion_coherente/i,
    );

    // Y tampoco al reves: un motivo sobre una cuenta activa.
    expect(
      await causaDe(dsql`update profiles set inactivacion_motivo = 'suelto' where id = ${usuarioId}`),
    ).toMatch(/profiles_inactivacion_coherente/i);
  });

  it("ACTIVO: ve a su paciente, y la cuenta esta habilitada", async () => {
    exigirFixture();
    const [{ activa }] = await db.execute(dsql`
      select public.cuenta_activa() as activa from (select set_config('request.jwt.claims',
        ${JSON.stringify({ sub: usuarioId, role: "authenticated" })}, true)) _`);
    expect(activa, "una cuenta en 'active' esta habilitada").toBe(true);
    expect(await loQueVe("patients"), "tiene que ver al menos su paciente").toBeGreaterThan(0);
  });

  it("al quitarle el acceso queda el motivo, el quien y el cuando", async () => {
    exigirFixture();
    const r = await writer.inactivarIntegrante({
      usuarioId,
      professionalId: profProfileId,
      motivo: "Prueba automatizada del offboarding (0229).",
      actorId: adminId,
      actorEmail: "prueba@cnv.test",
    });
    const e = await estado();
    expect(e.status).toBe("inactive");
    expect(e.desde).not.toBeNull();
    expect(e.motivo).toContain("offboarding");
    expect(e.por).toBe(adminId);
    // EL RETRATO VIAJA EN EL RESULTADO: es lo que el aviso de la pantalla repite, y lo que queda en el
    // asiento. Su paciente sigue contando como abierto, porque sigue siendo suyo.
    expect(r.abierto.pacientesActivos).toBeGreaterThan(0);
  });

  it("y el motivo no se escribe dos veces: el asiento lleva el retrato de lo que quedo abierto", async () => {
    exigirFixture();
    const [fila] = await db.execute(dsql`
      select payload from clinical_audit_log
       where event = 'user.deactivated' and entity_id = ${usuarioId}
       order by created_at desc limit 1`);
    expect(fila, "sin asiento no hay offboarding auditable (regla dura 8)").toBeTruthy();
    expect(fila.payload.motivo).toContain("offboarding");
    // DENTRO DE UN ANO, "se le quito el acceso" no contesta "y sus pacientes?". Con el retrato, si.
    expect(fila.payload.abierto.pacientesActivos).toBeGreaterThan(0);
    expect(Object.keys(fila.payload.abierto)).toContain("margenPendiente");
    expect(Object.keys(fila.payload.abierto)).toContain("remesasPorConfirmar");
    expect(Object.keys(fila.payload.abierto)).toContain("enlacesVigentes");
  });

  it("INACTIVO: la RLS deja de abrirle las historias clinicas, no solo las pantallas", async () => {
    exigirFixture();
    // ESTO ES LO QUE LA 0229 AGREGO. `requireUser()` ya lo echaba de las pantallas desde el principio, pero
    // la anon key es publica y su token de acceso sigue valido su hora: sin esta mitad, una llamada directa
    // a la API seguia pasando `patients_select`.
    expect(await loQueVe("patients"), "una cuenta sin acceso no abre ninguna historia clinica").toBe(0);
    expect(await loQueVe("patient_profiles")).toBe(0);
    expect(await loQueVe("evaluations")).toBe(0);
  });

  it("pero sus pacientes SIGUEN siendo suyos: quitar el acceso no reasigna nada", async () => {
    exigirFixture();
    // Es la regla dura 14 completa: desactivar Y REASIGNAR son dos actos. Mover pacientes en el mismo clic
    // dejaria un paciente cambiado de manos sin que nadie lo decidiera ni lo firmara.
    const [{ n }] = await db.execute(dsql`
      select count(*)::int as n from patient_professional_relationships
       where professional_id = ${profProfileId} and status = 'active'`);
    expect(n, "la relacion no se toca").toBeGreaterThan(0);

    // Y lo que queda abierto se puede volver a leer, con los que llegaron DESPUES contados aparte.
    const e = await estado();
    const abierto = await lector.loQueQuedaAbierto(profProfileId, e.desde);
    expect(abierto.pacientesActivos).toBe(n);
    expect(abierto.llegadosDespues, "el paciente se le asigno ANTES de inactivarlo").toBe(0);
  });

  it("al devolverle el acceso vuelve a ver lo suyo y las tres columnas se limpian", async () => {
    exigirFixture();
    await writer.reactivarIntegrante({
      usuarioId,
      professionalId: profProfileId,
      motivo: "Prueba automatizada: se le devuelve el acceso.",
      actorId: adminId,
      actorEmail: "prueba@cnv.test",
    });
    const e = await estado();
    expect(e.status).toBe("active");
    expect(e.desde, "describen la inactivacion VIGENTE: al reactivar se limpian").toBeNull();
    expect(e.motivo).toBeNull();
    expect(e.por).toBeNull();
    expect(await loQueVe("patients"), "recupera exactamente lo que veia").toBeGreaterThan(0);

    const [fila] = await db.execute(dsql`
      select payload from clinical_audit_log
       where event = 'user.reactivated' and entity_id = ${usuarioId}
       order by created_at desc limit 1`);
    expect(fila, "la vuelta atras tambien deja rastro").toBeTruthy();
    expect(fila.payload.motivo).toContain("devuelve");
  });

  it("nadie se quita el acceso a si mismo", async () => {
    exigirFixture();
    await expect(
      writer.inactivarIntegrante({
        usuarioId,
        professionalId: profProfileId,
        motivo: "Intento de quitarme el acceso a mi mismo.",
        actorId: usuarioId,
        actorEmail: "prueba@cnv.test",
      }),
    ).rejects.toThrow(/a ti mismo/i);
  });

  it("y el motivo corto no pasa, en los dos sentidos", async () => {
    exigirFixture();
    const corto = { usuarioId, professionalId: profProfileId, motivo: "no", actorId: adminId, actorEmail: null };
    await expect(writer.inactivarIntegrante(corto)).rejects.toThrow(/por qué/i);
    await expect(writer.reactivarIntegrante(corto)).rejects.toThrow(/por qué/i);
  });
});
