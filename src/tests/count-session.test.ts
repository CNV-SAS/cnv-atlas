import { and, eq, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Sesion de conteo (T3b-3 ST2). Verifica contra la BD real, ejecutando el writer:
//  - un faltante (fisico < saldo) abre UN caso por producto, ligado a la sesion, en reportado con su
//    apertura, con el precio sellado; el saldo del sistema NO se toca;
//  - un conteo que cuadra registra la sesion/linea SIN caso;
//  - un sobrante (fisico > saldo) se reporta, sin caso;
//  - parcial: solo las lineas contadas quedan registradas.
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("sesion de conteo: deteccion y apertura de casos (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let recordCount: any;
  let profId: string;
  let actorId: string;
  let nutraId: string;
  let stock: number;
  const sessions: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ recordCount } = await import("@/modules/nutraceuticals/data/count-writer"));
    const [prof] = await db.select({ id: schema.professionalProfiles.id, pid: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).limit(1);
    profId = prof.id;
    actorId = prof.pid;
    // un producto con saldo del profesional demo (>5 para poder contar de menos)
    const [inv] = await db
      .select({ nid: schema.nutraceuticalInventory.nutraceuticalId, stock: schema.nutraceuticalInventory.stockQuantity })
      .from(schema.nutraceuticalInventory)
      .where(and(eq(schema.nutraceuticalInventory.professionalId, profId), dsql`${schema.nutraceuticalInventory.stockQuantity} > 5`))
      .limit(1);
    nutraId = inv.nid;
    stock = Number(inv.stock);
  });

  afterAll(async () => {
    if (!sessions.length) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const s of sessions) {
      const cases = await db.select({ id: schema.nutraceuticalFaltanteCases.id }).from(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.countSessionId, s));
      for (const c of cases) {
        await db.delete(schema.nutraceuticalFaltanteTransitions).where(eq(schema.nutraceuticalFaltanteTransitions.caseId, c.id));
      }
      await db.delete(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.countSessionId, s));
      await db.delete(schema.nutraceuticalCountLines).where(eq(schema.nutraceuticalCountLines.sessionId, s));
      await db.delete(schema.nutraceuticalCountSessions).where(eq(schema.nutraceuticalCountSessions.id, s));
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("faltante: abre un caso ligado a la sesion, en reportado, con precio sellado; el saldo no se toca", async () => {
    const res = await recordCount({ professionalId: profId, actorId, note: null, now: new Date(), lines: [{ nutraceuticalId: nutraId, lote: "L1", physicalQty: stock - 2 }] });
    sessions.push(res.sessionId);
    expect(res.opened).toHaveLength(1);
    expect(res.opened[0].quantity).toBe(2);
    expect(res.cuadraron).toBe(0);

    const [c] = await db
      .select({ status: schema.nutraceuticalFaltanteCases.status, sess: schema.nutraceuticalFaltanteCases.countSessionId, qty: schema.nutraceuticalFaltanteCases.quantity, price: schema.nutraceuticalFaltanteCases.sealedUnitPrice })
      .from(schema.nutraceuticalFaltanteCases)
      .where(eq(schema.nutraceuticalFaltanteCases.countSessionId, res.sessionId));
    expect(c.status).toBe("reportado");
    expect(c.sess).toBe(res.sessionId);
    expect(c.qty).toBe(2);
    expect(Number(c.price)).toBeGreaterThan(0); // sellado del catalogo

    // el saldo del sistema NO cambio (baja al cerrar el caso, no al detectar)
    const [inv] = await db.select({ stock: schema.nutraceuticalInventory.stockQuantity }).from(schema.nutraceuticalInventory).where(and(eq(schema.nutraceuticalInventory.professionalId, profId), eq(schema.nutraceuticalInventory.nutraceuticalId, nutraId)));
    expect(Number(inv.stock)).toBe(stock);
  });

  it("cuadra: registra la sesion y la linea, sin abrir caso", async () => {
    const res = await recordCount({ professionalId: profId, actorId, note: "todo cuadra", now: new Date(), lines: [{ nutraceuticalId: nutraId, lote: null, physicalQty: stock }] });
    sessions.push(res.sessionId);
    expect(res.opened).toHaveLength(0);
    expect(res.cuadraron).toBe(1);
    const linesN = await db.select({ id: schema.nutraceuticalCountLines.id }).from(schema.nutraceuticalCountLines).where(eq(schema.nutraceuticalCountLines.sessionId, res.sessionId));
    expect(linesN).toHaveLength(1);
    const cases = await db.select({ id: schema.nutraceuticalFaltanteCases.id }).from(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.countSessionId, res.sessionId));
    expect(cases).toHaveLength(0);
  });

  it("sobrante: se reporta, sin caso", async () => {
    const res = await recordCount({ professionalId: profId, actorId, note: null, now: new Date(), lines: [{ nutraceuticalId: nutraId, lote: null, physicalQty: stock + 3 }] });
    sessions.push(res.sessionId);
    expect(res.opened).toHaveLength(0);
    expect(res.sobrantes).toHaveLength(1);
    expect(res.sobrantes[0].extra).toBe(3);
  });
});
