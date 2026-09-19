import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ LA ENTREGA DICE QUE SE ENTREGO (0148) ═══
//
// Atlas pasa al modelo del archivo de Gildardo: cada pantalla se imprime o se envia. Si solo la historia
// clinica dejara rastro, el modelo nuevo PERDERIA el registro legal en vez de ganarlo. Cada hoja escribe con su
// propio valor, y el rastro lo dice.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const creadas: string[] = [];

describe.skipIf(!HAS_DB)("el registro de entregas (BD real)", () => {
  let evaluationId = "";
  let patientId = "";
  let actorId = "";

  beforeAll(async () => {
    const { db } = await import("@/db");
    const [e] = await db.execute<{ id: string; patient_id: string }>(dsql`
      select id, patient_id from evaluations limit 1`);
    const [p] = await db.execute<{ id: string }>(dsql`select id from profiles limit 1`);
    evaluationId = e.id;
    patientId = e.patient_id;
    actorId = p.id;
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of creadas) await db.execute(dsql`delete from hc_deliveries where id = ${id}`);
  });

  it("cada hoja se registra con SU documento, y el rastro lo dice", async () => {
    const { writeHcDelivery } = await import("@/modules/reports/data/hc-entregas-writer");
    const { db } = await import("@/db");
    const correo = `smoke-${randomUUID().slice(0, 8)}@cnvsystem.com`;

    await writeHcDelivery({
      evaluationId,
      patientId,
      documento: "plan",
      sentTo: correo,
      actorId,
      actorEmail: "candado@cnvsystem.com",
      ip: null,
    });

    const [fila] = await db.execute<{ id: string; scope: string }>(dsql`
      select id, scope from hc_deliveries where sent_to = ${correo}`);
    creadas.push(fila.id);
    expect(fila.scope, "sin esto, 'se entrego algo' no prueba nada").toBe("plan");

    const [rastro] = await db.execute<{ scope: string }>(dsql`
      select payload->>'scope' as scope from clinical_audit_log
       where event = 'hc.delivered' and payload->>'delivery_id' = ${fila.id}`);
    expect(rastro?.scope, "el rastro clinico tiene que decir QUE salio").toBe("plan");
  });

  it("sin decir cual, se registra como la historia clínica: es lo único que se entregaba antes", async () => {
    const { writeHcDelivery } = await import("@/modules/reports/data/hc-entregas-writer");
    const { db } = await import("@/db");
    const correo = `smoke-${randomUUID().slice(0, 8)}@cnvsystem.com`;
    await writeHcDelivery({ evaluationId, patientId, sentTo: correo, actorId, actorEmail: "c@cnv.co", ip: null });
    const [fila] = await db.execute<{ id: string; scope: string }>(dsql`
      select id, scope from hc_deliveries where sent_to = ${correo}`);
    creadas.push(fila.id);
    expect(fila.scope).toBe("hc");
  });

  it("CONTROL: la base rechaza un documento que no existe", async () => {
    const { db } = await import("@/db");
    await expect(
      db.execute(dsql`
        insert into hc_deliveries (evaluation_id, patient_id, scope, sent_to, delivered_by, delivered_by_email)
        values (${evaluationId}, ${patientId}, 'inventado', 'x@y.co', ${actorId}, 'x@y.co')`),
      "un scope libre acaba con tres nombres para lo mismo",
    ).rejects.toThrow();
  });
});
