import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ ELIMINAR EL PERFIL, CONTRA LA BASE (v12 §1.2, migracion 0233) ═══
//
// CUATRO COSAS QUE SOLO LA BASE PUEDE CONTESTAR, y ninguna se puede comprobar leyendo el codigo:
//
//   1 · que SIN PETICION no se pueda eliminar, y que el CHECK lo sostenga tambien contra SQL a mano
//       (hasta el 2026-11-05 esto era "que el documento equivocado no elimine a nadie": ese paso salio,
//       y en su lugar se mide lo que de verdad frena el acto);
//   2 · que un paciente eliminado DESAPAREZCA de la vista del roster, que es de donde sale la lista;
//   3 · que los dos CHECK rechacen los estados imposibles (eliminado sin peticion, peticion sin motivo);
//   4 · y que con el rol `authenticated` (la anon key) el trigger frene la escritura, aunque la policy
//       `patients_update` deje tocar la fila.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let patientId = "";
let actorId = "";
let adminId = "";

describe.skipIf(!HAS_DB)("eliminar el perfil de un paciente (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    // SIN EL DOCUMENTO: el fixture lo traia para teclearlo, y ese paso salio el 2026-11-05. Una
    // consulta de prueba que trae el documento de un paciente real es PII que nadie usa.
    const [pac] = await db.execute<{ id: string }>(dsql`
      select id from patients where deleted_at is null order by created_at limit 1`);
    patientId = pac.id;
    const [prof] = await db.execute<{ id: string }>(dsql`
      select id from profiles order by created_at limit 1`);
    actorId = prof.id;
    // Un admin de verdad: su claim es el que hace que la RLS alcance la fila en el ultimo caso.
    const [adm] = await db.execute<{ id: string }>(dsql`
      select p.id from profiles p
        join user_roles ur on ur.user_id = p.id
        join roles r on r.id = ur.role_id
       where r.name = 'admin' limit 1`);
    adminId = adm.id;
    await db.execute(dsql`
      update patients set deleted_at = null, eliminado_por = null, eliminacion_pedida_at = null,
                          eliminacion_pedida_por = null, eliminacion_motivo = null
       where id = ${patientId}::uuid`);
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB || patientId === "") return;
    const { db } = await import("@/db");
    // SE DEJA COMO ESTABA: este test trabaja sobre un paciente REAL de la base local, asi que no puede
    // dejarlo eliminado. Los asientos de auditoria se quedan, que es lo correcto: ocurrieron.
    await db.execute(dsql`
      update patients set deleted_at = null, eliminado_por = null, eliminacion_pedida_at = null,
                          eliminacion_pedida_por = null, eliminacion_motivo = null
       where id = ${patientId}::uuid`);
  }, 30_000);

  it("la peticion no lo saca de la lista: sigue en la vista del roster", async () => {
    const { db } = await import("@/db");
    const { pedirLaEliminacionDelPaciente } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await pedirLaEliminacionDelPaciente({
      patientId,
      motivo: "Se creó dos veces por un error al escribir el documento",
      actorId,
      actorEmail: "profesional@cnv",
      ip: null,
    });
    const [p] = await db.execute<{ pedido: string | null; retirado: string | null }>(dsql`
      select eliminacion_pedida_at::text as pedido, deleted_at::text as retirado
        from patients where id = ${patientId}::uuid`);
    expect(p.pedido).not.toBeNull();
    // ES LA ASIMETRIA: si la peticion lo eliminara, el profesional podria sacarse de encima a un paciente
    // real sin que nadie lo revise.
    expect(p.retirado).toBeNull();
    const [enRoster] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from pacientes_del_roster where patient_id = ${patientId}::uuid`);
    expect(enRoster.n).toBe(1);
  }, 30_000);

  // ═══ AQUI SE MEDIA "el documento equivocado no elimina a nadie", Y EL PASO SALIO (2026-11-05) ═══
  //
  // Santiago: *"Fuera la cedula tecleada: era para un acto irreversible, y este se deshace."* El caso no
  // se puede conservar porque la comprobacion no existe, y borrarlo sin mas dejaria sin medir lo que de
  // verdad protege este acto. Asi que se sustituye por los DOS casos que sostienen la decision, que son
  // los que habia que comprobar antes de quitar el tramite.

  it("un paciente SIN peticion no se puede eliminar, aunque lo pida un administrador", async () => {
    // ES LA ASIMETRIA, Y AHORA ES LO UNICO QUE FRENA: el profesional pide, un administrador resuelve.
    // Sin el campo del documento, este es el guard que impide que un administrador saque a un paciente de
    // las listas por su cuenta, sin que nadie lo haya pedido ni dejado un motivo.
    const { db } = await import("@/db");
    const { resolverLaEliminacion, EliminacionDelPacienteError } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    // Se limpia la peticion para dejar al paciente sin ella, y se intenta eliminar.
    await db.execute(dsql`
      update patients
         set eliminacion_pedida_at = null, eliminacion_pedida_por = null, eliminacion_motivo = null
       where id = ${patientId}::uuid`);
    await expect(
      resolverLaEliminacion({ patientId, confirmar: true, actorId, actorEmail: "admin@cnv", ip: null }),
    ).rejects.toBeInstanceOf(EliminacionDelPacienteError);
    const [p] = await db.execute<{ retirado: string | null }>(dsql`
      select deleted_at::text as retirado from patients where id = ${patientId}::uuid`);
    expect(p.retirado).toBeNull();
    // Y SE DEJA COMO ESTABA para los casos de abajo, que esperan la peticion viva.
    await db.execute(dsql`
      update patients
         set eliminacion_pedida_at = now(), eliminacion_pedida_por = ${actorId}::uuid,
             eliminacion_motivo = 'se repitio el perfil por un error al escribir el documento'
       where id = ${patientId}::uuid`);
  }, 30_000);

  it("y el CHECK de la base no deja una eliminacion sin peticion ni escribiendo SQL a mano", async () => {
    // LA SEGUNDA MITAD, y la que no depende de nuestro codigo: `patients_eliminacion_coherente`. Con el
    // campo del documento fuera, conviene que quede medido que la asimetria vive tambien en la base.
    const { db } = await import("@/db");
    await expect(
      db.execute(dsql`
        update patients
           set deleted_at = now(), eliminado_por = ${actorId}::uuid,
               eliminacion_pedida_at = null, eliminacion_pedida_por = null, eliminacion_motivo = null
         where id = ${patientId}::uuid`),
    ).rejects.toThrow();
  }, 30_000);

  it("con la peticion viva se elimina, y desaparece de la vista del roster", async () => {
    const { db } = await import("@/db");
    const { resolverLaEliminacion } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await resolverLaEliminacion({
      patientId,
      confirmar: true,
      actorId,
      actorEmail: "admin@cnv",
      ip: null,
    });
    const [p] = await db.execute<{ retirado: string | null; por: string | null }>(dsql`
      select deleted_at::text as retirado, eliminado_por::text as por
        from patients where id = ${patientId}::uuid`);
    expect(p.retirado).not.toBeNull();
    expect(p.por).toBe(actorId);
    // LA LISTA SALE DE ESTA VISTA (0228), asi que esto es lo que de verdad significa "eliminado".
    const [enRoster] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from pacientes_del_roster where patient_id = ${patientId}::uuid`);
    expect(enRoster.n).toBe(0);
    // Y SU HISTORIA SIGUE AHI, que es la mitad que la palabra "eliminar" no dice: la fila existe, su
    // perfil existe y sus consultas existen.
    const [vive] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from patient_profiles where patient_id = ${patientId}::uuid`);
    expect(vive.n).toBe(1);
  }, 30_000);

  it("y el acto queda en el audit log, con quien y por que", async () => {
    const { db } = await import("@/db");
    const filas = await db.execute<{ event: string }>(dsql`
      select event from clinical_audit_log
       where entity_type = 'patient' and entity_id = ${patientId}
       order by created_at desc limit 5`);
    const eventos = filas.map((f) => f.event);
    expect(eventos).toContain("paciente.eliminado");
    expect(eventos).toContain("paciente.eliminacion_pedida");
  }, 30_000);

  it("restituir lo devuelve a la lista con su historia", async () => {
    const { db } = await import("@/db");
    const { restituirAlPaciente } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await restituirAlPaciente({ patientId, actorId, actorEmail: "admin@cnv", ip: null });
    const [p] = await db.execute<{ retirado: string | null; pedido: string | null }>(dsql`
      select deleted_at::text as retirado, eliminacion_pedida_at::text as pedido
        from patients where id = ${patientId}::uuid`);
    expect(p.retirado).toBeNull();
    // LA PETICION TAMBIEN SE LIMPIA: viva, volveria a ofrecer su eliminacion sin que nadie la pidiera.
    expect(p.pedido).toBeNull();
    const [enRoster] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from pacientes_del_roster where patient_id = ${patientId}::uuid`);
    expect(enRoster.n).toBe(1);
  }, 30_000);

  it("la base rechaza un eliminado SIN peticion", async () => {
    const { db } = await import("@/db");
    // Es la asimetria escrita donde no se puede saltar: ni con un UPDATE a mano.
    await expect(
      db.execute(dsql`
        update patients set deleted_at = now(), eliminado_por = ${actorId}::uuid
         where id = ${patientId}::uuid`),
    ).rejects.toThrow();
  }, 30_000);

  it("y una peticion SIN motivo", async () => {
    const { db } = await import("@/db");
    await expect(
      db.execute(dsql`
        update patients set eliminacion_pedida_at = now(), eliminacion_pedida_por = ${actorId}::uuid
         where id = ${patientId}::uuid`),
    ).rejects.toThrow();
  }, 30_000);

  it("con la clave publica (`authenticated`) el trigger frena la escritura", async () => {
    const { db } = await import("@/db");
    // POR QUE ESTE CASO EXISTE: `patients_update` (0003) deja escribir la fila al profesional dueno y a
    // admin, y la anon key es publica. Sin el trigger, la asimetria se saltaria con una llamada directa a
    // la API, aunque la pantalla pidiera el documento y el motivo.
    //
    // SE SIMULA COMO LO HACE PostgREST (igual que `rls.test.ts`): `set local role authenticated` mas el
    // claim que lee `auth.uid()`. Dentro de la transaccion, que ademas es la unica forma fiable: un `set`
    // suelto se reparte en conexiones distintas por el pool (lo enseno `session_replication_role`).
    //
    // Y CON EL CLAIM DE UN ADMIN A PROPOSITO: con un `authenticated` sin claim, la RLS no alcanza la fila
    // y el UPDATE afecta CERO filas, que no es un error. El test pasaria sin haber probado el trigger, que
    // es exactamente la forma en la que un candado se vuelve decorativo. La guarda de abajo lo impide.
    // Y EL MENSAJE DEL TRIGGER VIAJA EN LA CAUSA, no en el error: Drizzle envuelve el de Postgres en un
    // "Failed query: ...". Afirmar sobre el mensaje de arriba pasaria verde con CUALQUIER fallo de esa
    // consulta, incluido uno de sintaxis.
    let causa = "";
    try {
      await db.transaction(async (tx) => {
        await tx.execute(dsql`set local role authenticated`);
        const claims = JSON.stringify({ sub: adminId, role: "authenticated" });
        await tx.execute(dsql`select set_config('request.jwt.claims', ${claims}, true)`);
        const filas = await tx.execute<{ id: string }>(dsql`
          update patients set deleted_at = now(), eliminado_por = ${actorId}::uuid
           where id = ${patientId}::uuid returning id`);
        if (filas.length === 0) {
          throw new Error("la RLS no alcanzó la fila: este caso no probó el trigger");
        }
      });
    } catch (e) {
      causa = String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message);
    }
    expect(causa).toMatch(/desde Atlas/);
    const { db: dbo } = await import("@/db");
    const [p] = await dbo.execute<{ retirado: string | null }>(dsql`
      select deleted_at::text as retirado from patients where id = ${patientId}::uuid`);
    expect(p.retirado).toBeNull();
  }, 30_000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y QUE PASA CON LO QUE YA ESTABA DENTRO: INVESTIGACION, /obbia Y LA BODEGA  ·  Santiago, 2026-11-08
//
// ═══ LAS TRES PREGUNTAS, SUYAS Y TEXTUALES ═══
//
// *"¿un paciente eliminado logicamente sale de evaluaciones_para_investigacion, /obbia y la bodega? ¿Y al
// restituirlo, vuelve?"*
//
// ═══ POR QUE NO SE PUEDE CONTESTAR LEYENDO EL CODIGO ═══
//
// Porque el filtro NO esta en la vista que se nombra. `evaluaciones_para_investigacion` no menciona
// `deleted_at` en ninguna linea: lo hereda de `evaluaciones_vigentes`, de la que selecciona. O sea que
// quien busque la garantia en la vista de investigacion no la encuentra, y quien la mida la ve. El dia
// que alguien reescriba la vista de arriba leyendo de `evaluations` en vez de la de abajo, la garantia se
// cae sin que ningun test de codigo lo note.
//
// Y /obbia NO ES OTRA PREGUNTA: la pantalla, su filtro y su CSV leen esa misma vista (`cohorte-reader`,
// `exportar-la-cohorte`). Por eso el candado mide la vista, que es donde esta el hecho, y no tres
// pantallas.
//
// ═══ LA BODEGA ES EL CASO CONTRARIO, Y TAMBIEN SE AMARRA ═══
//
// Las ventas NO salen, y es deliberado: son documentos fiscales con su propia retencion, y la 0233 lo
// dejo escrito (*"NO toca las ventas ni las facturas"*). Se afirma aqui para que nadie lo "arregle"
// pensando que es un olvido: un paciente eliminado que desaparece de la contabilidad es un problema peor
// que el que se creia resolver.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe.skipIf(!HAS_DB)("un paciente eliminado y lo que ya estaba dentro (BD real)", () => {
  let pacienteEnLaCohorte = "";
  let consultasEnLaCohorte = 0;
  let adminDeLaCohorte = "";

  beforeAll(async () => {
    const { db } = await import("@/db");
    // UN PACIENTE QUE DE VERDAD ESTA EN LA COHORTE. Tomar "el primero de patients" dejaria el caso verde
    // sin haber medido nada: si no estaba dentro, no puede salir.
    const [uno] = await db.execute<{ patient_id: string; n: number }>(dsql`
      select v.patient_id, count(*)::int as n
        from public.evaluaciones_para_investigacion v
        join patients p on p.id = v.patient_id
       where p.deleted_at is null
       group by v.patient_id
       order by count(*) desc
       limit 1`);
    pacienteEnLaCohorte = uno?.patient_id ?? "";
    consultasEnLaCohorte = uno?.n ?? 0;
    const [adm] = await db.execute<{ id: string }>(dsql`
      select p.id from profiles p
        join user_roles ur on ur.user_id = p.id
        join roles r on r.id = ur.role_id
       where r.name = 'admin' limit 1`);
    adminDeLaCohorte = adm.id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB || pacienteEnLaCohorte === "") return;
    const { db } = await import("@/db");
    // SE DEJA COMO ESTABA: es un paciente REAL de la base local.
    await db.execute(dsql`
      update patients set deleted_at = null, eliminado_por = null, eliminacion_pedida_at = null,
                          eliminacion_pedida_por = null, eliminacion_motivo = null
       where id = ${pacienteEnLaCohorte}::uuid`);
  }, 30_000);

  it("el fixture encontro un paciente con consultas DENTRO de la cohorte", () => {
    expect(pacienteEnLaCohorte).not.toBe("");
    expect(consultasEnLaCohorte).toBeGreaterThan(0);
  });

  it("al eliminarlo, sus consultas SALEN de evaluaciones_para_investigacion (y de /obbia, que la lee)", async () => {
    const { db } = await import("@/db");
    const { pedirLaEliminacionDelPaciente, resolverLaEliminacion } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await pedirLaEliminacionDelPaciente({
      patientId: pacienteEnLaCohorte,
      motivo: "candado: medir la salida de la cohorte",
      actorId: adminDeLaCohorte,
      actorEmail: "admin@cnv",
      ip: null,
    });
    await resolverLaEliminacion({
      patientId: pacienteEnLaCohorte,
      confirmar: true,
      actorId: adminDeLaCohorte,
      actorEmail: "admin@cnv",
      ip: null,
    });
    const [dentro] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from public.evaluaciones_para_investigacion
       where patient_id = ${pacienteEnLaCohorte}::uuid`);
    expect(dentro.n, "un paciente eliminado sigue entrando a investigacion").toBe(0);
  }, 60_000);

  it("y NINGUNA consulta de NINGUN paciente eliminado esta dentro", async () => {
    const { db } = await import("@/db");
    // La pregunta en grande, no solo sobre el paciente del fixture: es la que importa si algun dia la
    // vista de arriba deja de leer la de abajo.
    const [fuera] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n
        from public.evaluaciones_para_investigacion v
        join patients p on p.id = v.patient_id
       where p.deleted_at is not null`);
    expect(fuera.n).toBe(0);
  }, 30_000);

  it("al restituirlo, vuelven las MISMAS consultas que tenia", async () => {
    const { db } = await import("@/db");
    const { restituirAlPaciente } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await restituirAlPaciente({
      patientId: pacienteEnLaCohorte,
      actorId: adminDeLaCohorte,
      actorEmail: "admin@cnv",
      ip: null,
    });
    const [dentro] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from public.evaluaciones_para_investigacion
       where patient_id = ${pacienteEnLaCohorte}::uuid`);
    // NO "mas de cero": las MISMAS. Eliminar y restituir no puede cambiar el tamaño de la cohorte, porque
    // entonces el "n" de un articulo dependeria de un acto administrativo.
    expect(dentro.n).toBe(consultasEnLaCohorte);
  }, 60_000);

  it("la garantia la hereda de `evaluaciones_vigentes`, y eso se dice en voz alta", async () => {
    const { db } = await import("@/db");
    const [inv] = await db.execute<{ def: string }>(dsql`
      select pg_get_viewdef('public.evaluaciones_para_investigacion'::regclass, true) as def`);
    const [vig] = await db.execute<{ def: string }>(dsql`
      select pg_get_viewdef('public.evaluaciones_vigentes'::regclass, true) as def`);
    // Si alguien reescribe la de investigacion leyendo de `evaluations`, este caso cae y dice por que.
    expect(inv.def, "la vista de investigacion dejo de leer evaluaciones_vigentes").toMatch(
      /evaluaciones_vigentes/,
    );
    expect(vig.def, "evaluaciones_vigentes dejo de filtrar deleted_at").toMatch(/deleted_at/);
  }, 30_000);

  it("pero las VENTAS no salen, y es deliberado (documento fiscal con su propia retencion)", async () => {
    const { db } = await import("@/db");
    const [ventas] = await db.execute<{ def: string }>(dsql`
      select pg_get_viewdef('public.ventas_reales'::regclass, true) as def`);
    expect(
      /deleted_at/.test(ventas.def),
      "alguien puso deleted_at en ventas_reales: eliminar un perfil no puede borrar la contabilidad",
    ).toBe(false);
  }, 30_000);
});
