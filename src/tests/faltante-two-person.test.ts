import { eq, sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Gate de dos personas del faltante (T3b-3 ST4). Verifica en la BD real que 'injustificado' SOLO se
// alcanza desde 'injustificado_pendiente' (lista de transiciones permitidas, mig 0046): un salto directo
// en_revision -> injustificado se rechaza. Y que direccion puede RECHAZAR (injustificado_pendiente ->
// justificado), dejando el caso sin cargo. Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("faltante: gate de dos personas (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let profId: string;
  let nutraId: string;
  let actorId: string;
  const cases: string[] = [];

  async function newCase(): Promise<string> {
    const id = (
      await db
        .insert(schema.nutraceuticalFaltanteCases)
        .values({ professionalId: profId, nutraceuticalId: nutraId, quantity: 1, sealedUnitPrice: "1000", sealedTotal: "1000", reportedAt: new Date(), deadlineAt: new Date(Date.now() + 86400000), createdBy: actorId })
        .returning({ id: schema.nutraceuticalFaltanteCases.id })
    )[0].id;
    cases.push(id);
    return id;
  }
  async function tx(caseId: string, from: string | null, to: string) {
    await db.insert(schema.nutraceuticalFaltanteTransitions).values({ caseId, fromStatus: from as any, toStatus: to as any, actorId });
  }
  async function status(caseId: string) {
    const [c] = await db.select({ s: schema.nutraceuticalFaltanteCases.status, ch: schema.nutraceuticalFaltanteCases.chargeStatus }).from(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.id, caseId));
    return c;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    const [prof] = await db.select({ id: schema.professionalProfiles.id, pid: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).limit(1);
    profId = prof.id;
    actorId = prof.pid;
    // MULTICELL (702): producto DEDICADO (ver faltante-case.test). El settle al cerrar muta su saldo, pero
    // ningun test lee el saldo de MULTICELL, asi que no interfiere aunque corran en paralelo.
    nutraId = "77777777-7777-7777-7777-777777777702";
  });

  afterEach(async () => {
    if (!cases.length) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const c of cases) {
      await db.delete(schema.nutraceuticalFaltanteTransitions).where(eq(schema.nutraceuticalFaltanteTransitions.caseId, c));
      await db.delete(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.id, c));
    }
    // Los cierres a terminal dispararon el settle (conciliacion -N, mig 0048); se borran y se recomputa el
    // saldo, o el producto queda driftado para otro test en paralelo que lo comparta.
    await db.execute(dsql`delete from nutraceutical_stock_movements where professional_id = ${profId} and nutraceutical_id = ${nutraId} and reason like 'Conciliacion por faltante%'`);
    await db.execute(dsql`update nutraceutical_inventory i set stock_quantity = coalesce((select sum(m.delta) from nutraceutical_stock_movements m where m.professional_id = i.professional_id and m.nutraceutical_id = i.nutraceutical_id), 0) where i.professional_id = ${profId} and i.nutraceutical_id = ${nutraId}`);
    cases.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("NO se puede saltar a injustificado sin pasar por injustificado_pendiente", async () => {
    const c = await newCase();
    await tx(c, null, "reportado");
    await tx(c, "reportado", "en_revision");
    // salto directo prohibido
    await expect(tx(c, "en_revision", "injustificado")).rejects.toThrow();
    // el caso sigue en_revision, sin cargo
    const s = await status(c);
    expect(s.s).toBe("en_revision");
    expect(s.ch).toBe("sin_cargo");
  });

  it("camino de dos personas: pendiente -> injustificado materializa el cargo", async () => {
    const c = await newCase();
    await tx(c, null, "reportado");
    await tx(c, "reportado", "en_revision");
    await tx(c, "en_revision", "injustificado_pendiente"); // admin propone
    expect((await status(c)).ch).toBe("sin_cargo"); // aun no
    await tx(c, "injustificado_pendiente", "injustificado"); // direccion confirma
    const s = await status(c);
    expect(s.s).toBe("injustificado");
    expect(s.ch).toBe("pendiente_liquidacion");
  });

  it("direccion puede RECHAZAR: pendiente -> justificado deja el caso sin cargo", async () => {
    const c = await newCase();
    await tx(c, null, "reportado");
    await tx(c, "reportado", "en_revision");
    await tx(c, "en_revision", "injustificado_pendiente");
    await tx(c, "injustificado_pendiente", "justificado"); // direccion rechaza el cargo
    const s = await status(c);
    expect(s.s).toBe("justificado");
    expect(s.ch).toBe("sin_cargo");
  });
});
