import { and, eq, ne, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// T3b-3 ST5 (BD real):
//  - SETTLE: al cerrar un faltante (estado terminal), un trigger inserta una conciliacion -cantidad y el
//    saldo baja. El producto no esta, pase quien pase por el.
//  - SOBRANTE: contado > saldo se resuelve con una conciliacion +extra (motivo obligatorio) que sube el
//    saldo; la linea deja de estar pendiente.
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("faltante ST5: settle al cerrar y resolucion de sobrante (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let recordCount: any;
  let getPendingSobrantes: any;
  let resolveSobrante: any;
  let profId: string;
  let actorId: string;
  let nutraId: string;
  const cases: string[] = [];
  const sessions: string[] = [];

  async function saldo(): Promise<number> {
    const [r] = await db.select({ s: schema.nutraceuticalInventory.stockQuantity }).from(schema.nutraceuticalInventory).where(and(eq(schema.nutraceuticalInventory.professionalId, profId), eq(schema.nutraceuticalInventory.nutraceuticalId, nutraId)));
    return r ? Number(r.s) : 0;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ recordCount, getPendingSobrantes, resolveSobrante } = await import("@/modules/nutraceuticals/data/count-writer"));
    const [prof] = await db.select({ id: schema.professionalProfiles.id, pid: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).limit(1);
    profId = prof.id;
    actorId = prof.pid;
    // producto con saldo, EXCLUYENDO CURCUMIN (77777777-...703) que nutra-inventory.test muta en paralelo.
    const CURCUMIN = "77777777-7777-7777-7777-777777777703";
    // offset 1: toma el SEGUNDO producto no-CURCUMIN (count-session.test toma el primero, offset 0). Asi los
    // dos tests, que corren en paralelo, mutan productos distintos y no se pisan el saldo.
    const [inv] = await db
      .select({ nid: schema.nutraceuticalInventory.nutraceuticalId })
      .from(schema.nutraceuticalInventory)
      .where(and(eq(schema.nutraceuticalInventory.professionalId, profId), ne(schema.nutraceuticalInventory.nutraceuticalId, CURCUMIN), dsql`${schema.nutraceuticalInventory.stockQuantity} > 5`))
      .orderBy(schema.nutraceuticalInventory.nutraceuticalId)
      .limit(1)
      .offset(1);
    nutraId = inv.nid;
  });

  afterAll(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    // borra los movimientos de prueba (settle + resolucion de sobrante) de este producto, luego recomputa el saldo.
    await db.execute(dsql`delete from nutraceutical_stock_movements where professional_id = ${profId} and nutraceutical_id = ${nutraId} and (reason like 'Conciliacion por faltante%' or count_line_id is not null)`);
    for (const c of cases) {
      await db.delete(schema.nutraceuticalFaltanteTransitions).where(eq(schema.nutraceuticalFaltanteTransitions.caseId, c));
      await db.delete(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.id, c));
    }
    for (const s of sessions) {
      await db.delete(schema.nutraceuticalCountLines).where(eq(schema.nutraceuticalCountLines.sessionId, s));
      await db.delete(schema.nutraceuticalCountSessions).where(eq(schema.nutraceuticalCountSessions.id, s));
    }
    await db.execute(dsql`update nutraceutical_inventory i set stock_quantity = coalesce((select sum(m.delta) from nutraceutical_stock_movements m where m.professional_id = i.professional_id and m.nutraceutical_id = i.nutraceutical_id), 0) where i.professional_id = ${profId} and i.nutraceutical_id = ${nutraId}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("SETTLE: cerrar un faltante baja el saldo por la cantidad (conciliacion -N)", async () => {
    const before = await saldo();
    const caseId = (
      await db.insert(schema.nutraceuticalFaltanteCases).values({ professionalId: profId, nutraceuticalId: nutraId, quantity: 1, sealedUnitPrice: "1000", sealedTotal: "1000", reportedAt: new Date(), deadlineAt: new Date(Date.now() + 86400000), createdBy: actorId }).returning({ id: schema.nutraceuticalFaltanteCases.id })
    )[0].id;
    cases.push(caseId);
    await db.insert(schema.nutraceuticalFaltanteTransitions).values({ caseId, fromStatus: null, toStatus: "reportado", actorId });
    await db.insert(schema.nutraceuticalFaltanteTransitions).values({ caseId, fromStatus: "reportado", toStatus: "en_revision", actorId });
    await db.insert(schema.nutraceuticalFaltanteTransitions).values({ caseId, fromStatus: "en_revision", toStatus: "justificado", actorId }); // cierre terminal

    // el trigger inserto una conciliacion -1 y el saldo bajo
    const [mv] = await db.select({ delta: schema.nutraceuticalStockMovements.delta }).from(schema.nutraceuticalStockMovements).where(and(eq(schema.nutraceuticalStockMovements.professionalId, profId), eq(schema.nutraceuticalStockMovements.nutraceuticalId, nutraId), dsql`${schema.nutraceuticalStockMovements.reason} like 'Conciliacion por faltante%'`)).limit(1);
    expect(mv.delta).toBe(-1);
    expect(await saldo()).toBe(before - 1);
  });

  it("SOBRANTE: contar de mas y resolver sube el saldo, y deja de estar pendiente", async () => {
    const before = await saldo();
    const res = await recordCount({ professionalId: profId, actorId, note: null, now: new Date(), lines: [{ nutraceuticalId: nutraId, lote: null, physicalQty: before + 2 }] });
    sessions.push(res.sessionId);
    expect(res.sobrantes).toHaveLength(1);

    const pend = await getPendingSobrantes();
    const mine = pend.find((p: any) => p.nutraceuticalName && p.extra === 2);
    expect(mine).toBeTruthy();

    const r = await resolveSobrante({ countLineId: mine.countLineId, actorId, reason: "recepcion no registrada (test)" });
    expect(r.ok).toBe(true);
    expect(await saldo()).toBe(before + 2); // subio

    // ya no esta pendiente
    const pend2 = await getPendingSobrantes();
    expect(pend2.find((p: any) => p.countLineId === mine.countLineId)).toBeFalsy();
  });
});
