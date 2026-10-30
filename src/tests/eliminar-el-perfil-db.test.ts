import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ ELIMINAR EL PERFIL, CONTRA LA BASE (v12 §1.2, migracion 0233) ═══
//
// CUATRO COSAS QUE SOLO LA BASE PUEDE CONTESTAR, y ninguna se puede comprobar leyendo el codigo:
//
//   1 · que el documento equivocado NO elimine a nadie (y que el bueno si);
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
let documento = "";
let adminId = "";

describe.skipIf(!HAS_DB)("eliminar el perfil de un paciente (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [pac] = await db.execute<{ id: string; documento: string }>(dsql`
      select id, document_number as documento from patients where deleted_at is null
       order by created_at limit 1`);
    patientId = pac.id;
    documento = pac.documento;
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

  it("el documento equivocado no elimina a nadie", async () => {
    const { db } = await import("@/db");
    const { resolverLaEliminacion, EliminacionDelPacienteError } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await expect(
      resolverLaEliminacion({
        patientId,
        confirmar: true,
        documento: `${documento}9`,
        actorId,
        actorEmail: "admin@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(EliminacionDelPacienteError);
    const [p] = await db.execute<{ retirado: string | null }>(dsql`
      select deleted_at::text as retirado from patients where id = ${patientId}::uuid`);
    expect(p.retirado).toBeNull();
  }, 30_000);

  it("con el documento bueno se elimina, y desaparece de la vista del roster", async () => {
    const { db } = await import("@/db");
    const { resolverLaEliminacion } = await import(
      "@/modules/patients/data/eliminacion-del-paciente-writer"
    );
    await resolverLaEliminacion({
      patientId,
      confirmar: true,
      documento,
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
