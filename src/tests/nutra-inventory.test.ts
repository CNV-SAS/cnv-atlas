import { sql as dsql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// Inventario de nutraceuticos en CONSIGNACION (T3b-1). El saldo (nutraceutical_inventory.stock_quantity)
// es un CACHE que SOLO mueve el trigger del movimiento. Este test es el "detector de corrupcion" gratis
// que pidio la revision: si el saldo y la suma de movimientos difieren, algo escribio el saldo por fuera.
// Ademas verifica la inmutabilidad (un movimiento no se edita ni se borra) contra la BD real.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const PROF = "33333333-3333-3333-3333-333333333333"; // profesional demo
const NUT = "77777777-7777-7777-7777-777777777703"; // CURCUMIN BIOACTIV (en_consultorio)

describe.skipIf(!HAS_DB)("inventario en consignacion: saldo cacheado y movimientos inmutables", () => {
  afterEach(async () => {
    const { db } = await import("@/db");
    // Limpia los movimientos de prueba de ESTE test (via replica, para saltar el append-only), sin tocar
    // los del seed (reason distinto). Borrar por replica NO dispara el trigger del saldo, asi que ademas
    // se RECOMPUTA el saldo = suma de los movimientos restantes (si no, quedaria driftado y el DETECTOR
    // de otra corrida fallaria).
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from nutraceutical_stock_movements where professional_id = ${PROF} and nutraceutical_id = ${NUT} and reason = 'test-nutra-inventory'`);
    await db.execute(dsql`update nutraceutical_inventory i set stock_quantity = coalesce((select sum(m.delta) from nutraceutical_stock_movements m where m.professional_id = i.professional_id and m.nutraceutical_id = i.nutraceutical_id), 0) where i.professional_id = ${PROF} and i.nutraceutical_id = ${NUT}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("DETECTOR: todo saldo cacheado == la suma de sus movimientos", async () => {
    const { db } = await import("@/db");
    const rows = await db.execute<{ stock_quantity: number; suma: number }>(dsql`
      select i.stock_quantity,
             coalesce((select sum(m.delta) from nutraceutical_stock_movements m
               where m.professional_id = i.professional_id and m.nutraceutical_id = i.nutraceutical_id), 0) as suma
      from nutraceutical_inventory i`);
    for (const r of rows) {
      expect(Number(r.stock_quantity), "el saldo cacheado difiere de la suma de movimientos").toBe(Number(r.suma));
    }
  });

  it("una recepcion mueve el saldo por el delta (via el trigger)", async () => {
    const { db } = await import("@/db");
    const before = await db.execute<{ stock_quantity: number }>(dsql`select coalesce(stock_quantity,0) as stock_quantity from nutraceutical_inventory where professional_id = ${PROF} and nutraceutical_id = ${NUT}`);
    const prev = before.length ? Number(before[0].stock_quantity) : 0;
    await db.execute(dsql`insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason) values (${PROF}, ${NUT}, 5, 'recepcion', 'test-nutra-inventory')`);
    const after = await db.execute<{ stock_quantity: number }>(dsql`select stock_quantity from nutraceutical_inventory where professional_id = ${PROF} and nutraceutical_id = ${NUT}`);
    expect(Number(after[0].stock_quantity)).toBe(prev + 5);
  });

  it("un movimiento es inmutable: no se puede editar ni borrar", async () => {
    const { db } = await import("@/db");
    const ins = await db.execute<{ id: string }>(dsql`insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason) values (${PROF}, ${NUT}, 3, 'recepcion', 'test-nutra-inventory') returning id`);
    const id = ins[0].id;
    await expect(db.execute(dsql`update nutraceutical_stock_movements set delta = 99 where id = ${id}`)).rejects.toThrow();
    await expect(db.execute(dsql`delete from nutraceutical_stock_movements where id = ${id}`)).rejects.toThrow();
  });

  it("el saldo no se puede escribir directo con un valor que no sea la suma (coherencia)", async () => {
    const { db } = await import("@/db");
    // asegura que exista la fila (una recepcion la crea)
    await db.execute(dsql`insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason) values (${PROF}, ${NUT}, 1, 'recepcion', 'test-nutra-inventory')`);
    await expect(
      db.execute(dsql`update nutraceutical_inventory set stock_quantity = 9999 where professional_id = ${PROF} and nutraceutical_id = ${NUT}`),
    ).rejects.toThrow();
  });
});
