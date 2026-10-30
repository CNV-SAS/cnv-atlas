import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ LA ENTREGA DE INVESTIGACION QUEDA REGISTRADA, CONTRA LA BASE (Santiago, 2026-10-30) ═══
//
// LO QUE SOLO LA BASE PUEDE CONTESTAR: que el `anonymization_level` que escribimos PASE el CHECK del
// vocabulario (migracion 0227) y que la fila y su asiento salgan de la MISMA transaccion. Lo primero es
// real: la columna acepta tres valores y uno inventado se rechaza en runtime, no en tsc.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let actorId = "";
let datasetId = "";

describe.skipIf(!HAS_DB)("el registro de la entrega del resumen (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string }>(dsql`
      select id from profiles order by created_at limit 1`);
    actorId = prof.id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB || datasetId === "") return;
    const { db } = await import("@/db");
    // La fila de prueba se limpia; el ASIENTO se queda, y eso es correcto: `clinical_audit_log` es
    // append-only y el acto ocurrio.
    await db.execute(dsql`delete from research_datasets where id = ${datasetId}::uuid`);
  }, 30_000);

  it("escribe la fila con el nivel DERIVADO y la deja en «entregado»", async () => {
    const { db } = await import("@/db");
    const { registrarLaEntregaDelResumen } = await import(
      "@/modules/obbia/data/registro-de-la-entrega-writer"
    );
    const entrega = await registrarLaEntregaDelResumen({
      alcance: "Resumen agregado de la cohorte (prueba automatizada). Sin filas de paciente.",
      actorId,
      actorEmail: "obbia@cnv",
      cifras: { vigentes: 1, autorizadas: 1, pacientes: 1, conDiagnostico: 1 },
    });
    datasetId = entrega.id;
    // AGREGADO porque el export no lleva filas; si llevara, esta cifra cambiaria sola.
    expect(entrega.nivel).toBe("aggregate");

    const [fila] = await db.execute<{
      scope: string;
      nivel: string;
      status: string;
      requested_by: string;
    }>(dsql`
      select scope, anonymization_level as nivel, status, requested_by::text as requested_by
        from research_datasets where id = ${datasetId}::uuid`);
    expect(fila.nivel).toBe("aggregate");
    expect(fila.status).toBe("entregado");
    expect(fila.requested_by).toBe(actorId);
    expect(fila.scope).toContain("Sin filas de paciente");
  }, 30_000);

  it("y el asiento de auditoría apunta a esa fila", async () => {
    const { db } = await import("@/db");
    const filas = await db.execute<{ event: string; payload: unknown }>(dsql`
      select event, payload from clinical_audit_log
       where entity_type = 'research_dataset' and entity_id = ${datasetId}
       limit 1`);
    expect(filas.length, "la entrega no dejó asiento").toBe(1);
    expect(filas[0].event).toBe("investigacion.resumen_exportado");
    // LAS CIFRAS QUE VIAJARON van en el payload: sin ellas no se puede saber QUE decia el archivo que
    // salio, y el registro contestaria "se entrego algo" y nada mas.
    expect(JSON.stringify(filas[0].payload)).toContain("autorizadas");
  }, 30_000);

  it("y un nivel inventado lo rechaza la base, no el código", async () => {
    const { db } = await import("@/db");
    // Es el CHECK de la 0227. Vale la pena comprobarlo: el tipo de Drizzle lo impide al compilar, pero la
    // garantía de que el vocabulario está cerrado es de la base, y es la que sigue valiendo para un
    // UPDATE a mano o un camino nuevo.
    await expect(
      db.execute(dsql`
        update research_datasets set anonymization_level = 'anonimo_del_todo'
         where id = ${datasetId}::uuid`),
    ).rejects.toThrow();
  }, 30_000);
});
