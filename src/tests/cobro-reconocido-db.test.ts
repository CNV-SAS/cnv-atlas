import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { FILTRO_FUERA_DE_REVISION } from "@/modules/payments/cobro-reconocido";

// ═══ UNA VENTA EN REVISION NO CUENTA COMO COBRO (contabilidad, 2026-09-14) ═══
//
// Un pago aprobado sobre un link anulado es un PASIVO hasta resolverse. Antes sumaba en el cobrado bruto de
// Direccion y en las ventas del mes del profesional, porque los dos leian solo `status = paid`.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

describe("los dos tableros usan el filtro (el defecto era una omision en cada lector)", () => {
  it.each(["src/modules/direccion/data/dashboard-reader.ts", "src/modules/dashboard/data/tablero-reader.ts"])(
    "%s",
    (archivo) => {
      const src = readFileSync(archivo, "utf8");
      expect(src).toMatch(/\.eq\("status", "paid"\)\.or\(FILTRO_FUERA_DE_REVISION\)/);
    },
  );
});

describe.skipIf(!HAS_DB)("el filtro contra PostgREST (BD real)", () => {
  it("fuera la venta en revision; dentro la normal y la resuelta como segunda compra", async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const ids = { normal: randomUUID(), enRevision: randomUUID(), segundaCompra: randomUUID() };
    await db.execute(dsql`
      insert into transactions (id, organization_id, status, amount, currency, wompi_env, idempotency_key,
                                review_reason, review_resolution, reviewed_at) values
        (${ids.normal}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`cobro-${randomUUID()}`}, null, null, null),
        (${ids.enRevision}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`cobro-${randomUUID()}`}, 'pago_sobre_link_anulado', null, null),
        (${ids.segundaCompra}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`cobro-${randomUUID()}`}, 'pago_sobre_link_anulado', 'segunda_compra', now())`);

    const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await cliente
      .from("transactions")
      .select("id")
      .in("id", Object.values(ids))
      .eq("status", "paid")
      .or(FILTRO_FUERA_DE_REVISION);
    expect(error).toBeNull();
    const vistos = new Set((data ?? []).map((r) => r.id));
    expect(vistos.has(ids.normal)).toBe(true);
    expect(vistos.has(ids.segundaCompra)).toBe(true);
    expect(vistos.has(ids.enRevision)).toBe(false);

    // CONTROL: sin el filtro, la de revision si sumaba.
    const sin = await cliente.from("transactions").select("id").in("id", Object.values(ids)).eq("status", "paid");
    expect(sin.data).toHaveLength(3);

    await db.execute(dsql`delete from transactions where id in (${ids.normal}, ${ids.enRevision}, ${ids.segundaCompra})`);
  });
});
