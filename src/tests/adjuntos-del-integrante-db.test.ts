import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ EL HISTORIAL DE ADJUNTOS (0179, 2026-09-25) ═══
//
// LO QUE PUEDE IR MAL AQUI ES UNA SOLA COSA: que el CACHE (`professional_profiles.rut_path`) y el HISTORIAL
// digan cosas distintas. El cache se queda porque lo leen el gate de la liquidacion, la cola de verificacion y
// la ruta /rut/[id]; la fuente de verdad es la tabla. Si discreparan, la pestaña de adjuntos y la liquidacion
// hablarian de RUT distintos.
//
// Y DOS BORDES QUE SE PUEDEN ROMPER SIN QUE SE NOTE:
//   · que el adjunto nuevo se retire A SI MISMO al retirar al anterior (dejando al integrante sin vigente);
//   · y que el retro-relleno del RUT viejo se ejecute dos veces y cree dos vigentes.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let professionalId = "";

describe.skipIf(!HAS_DB)("los adjuntos del integrante (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string }>(dsql`
      select pp.id from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by p.full_name limit 1`);
    professionalId = prof.id;
    await db.execute(dsql`delete from professional_attachments where professional_id = ${professionalId}::uuid`);
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from professional_attachments where professional_id = ${professionalId}::uuid`);
  }, 30_000);

  it("el segundo RUT retira al primero apuntando a él, y NO se retira a sí mismo", async () => {
    const { db } = await import("@/db");
    const { registrarAdjunto, listarAdjuntos } = await import("@/modules/professionals/data/adjuntos-writer");

    await db.transaction(async (tx) => {
      await registrarAdjunto(tx, { professionalId, kind: "rut", path: "zz/fixture/rut-1.pdf" });
    });
    await db.transaction(async (tx) => {
      await registrarAdjunto(tx, { professionalId, kind: "rut", path: "zz/fixture/rut-2.pdf" });
    });

    const historial = await listarAdjuntos(professionalId);
    expect(historial).toHaveLength(2);
    // EXACTAMENTE UNO VIGENTE. Si el nuevo se retirara a si mismo (el UPDATE sin `id <>`), aqui habria CERO y
    // el integrante quedaria sin RUT vigente justo despues de subirlo.
    expect(historial.filter((a) => a.vigente)).toHaveLength(1);
    expect(historial.find((a) => a.vigente)).toBeDefined();
    expect(historial.filter((a) => !a.vigente)[0]?.reemplazadoEn).not.toBeNull();
  }, 30_000);

  it("la base impide dos vigentes del mismo tipo", async () => {
    const { db } = await import("@/db");
    // Sin el indice, "su RUT" tendria dos respuestas, que es justo lo que esta tabla viene a cerrar.
    await expect(
      db.execute(dsql`
        insert into professional_attachments (professional_id, kind, path)
        values (${professionalId}::uuid, 'rut', 'zz/fixture/rut-3.pdf')`),
    ).rejects.toThrow();
  }, 30_000);

  it("un adjunto reemplazado tiene que decir POR CUÁL", async () => {
    const { db } = await import("@/db");
    // "superseded_at sin superseded_by" seria un adjunto RETIRADO sin sucesor, que es otra cosa y no es lo que
    // esta tabla modela. Lo vigila un CHECK.
    await expect(
      db.execute(dsql`
        update professional_attachments set superseded_at = now(), superseded_by = null
         where professional_id = ${professionalId}::uuid and superseded_at is null`),
    ).rejects.toThrow();
  }, 30_000);

  it("el retro-relleno del RUT viejo no crea dos vigentes al correr dos veces", async () => {
    const { db } = await import("@/db");
    const { registrarRutQueYaEstaba, listarAdjuntos } = await import(
      "@/modules/professionals/data/adjuntos-writer"
    );
    // Se simula el integrante de antes de la 0179: tiene cache y ningun adjunto.
    await db.execute(dsql`delete from professional_attachments where professional_id = ${professionalId}::uuid`);
    const [antes] = await db.execute<{ rut_path: string | null }>(dsql`
      select rut_path from professional_profiles where id = ${professionalId}::uuid`);
    await db.execute(dsql`
      update professional_profiles set rut_path = 'zz/fixture/rut-viejo.pdf' where id = ${professionalId}::uuid`);

    // La pagina lo llama en CADA visita, asi que correrlo dos veces es el caso normal, no un borde raro.
    await registrarRutQueYaEstaba(professionalId);
    await registrarRutQueYaEstaba(professionalId);

    const historial = await listarAdjuntos(professionalId);
    expect(historial.filter((a) => a.vigente)).toHaveLength(1);

    await db.execute(dsql`
      update professional_profiles set rut_path = ${antes.rut_path} where id = ${professionalId}::uuid`);
  }, 30_000);
});
