import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// ═══ LOS LECTORES DE SALDO CONTRA LA BASE REAL (ver saldo-por-lote.test.ts) ═══
//
// Las funciones de verdad, sobre un producto que TIENE varios lotes. Con el mapa directo de antes, el
// saldo devuelto era el de un solo lote y estos tests quedan en rojo.

vi.mock("server-only", () => ({}));

// ── CONTRA LA BASE REAL: las funciones de verdad, con un producto que TIENE varios lotes ──────────
let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

vi.mock("@/lib/supabase/server", () => ({
  // Service role SOLO en el test: lo que se prueba es la aritmetica del lector, no la RLS, que ya tiene
  // sus propios tests. Con el cliente de sesion haria falta un usuario autenticado y no cambiaria nada.
  createSupabaseServerClient: async () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    }),
}));

describe.skipIf(!HAS_DB)("los lectores contra la base (BD real)", () => {
  async function productoConVariosLotes() {
    const { db } = await import("@/db");
    const [f] = await db.execute<{ profile_id: string; nutraceutical_id: string; total: number; lotes: number }>(dsql`
      select pp.profile_id, i.nutraceutical_id, sum(i.stock_quantity)::int as total, count(*)::int as lotes
        from nutraceutical_inventory i
        join professional_profiles pp on pp.id = i.professional_id
       group by pp.profile_id, i.nutraceutical_id
      -- DOS LOTES CON EXISTENCIAS, no solo dos filas. La primera version aceptaba un lote en 0, y ahi "el
      -- ultimo lote" puede coincidir con el total: el test paso con el codigo viejo, que es como se descubrio.
      having count(*) filter (where i.stock_quantity <> 0) > 1
       limit 1`);
    return f;
  }

  it("CONTROL: en la base hay un producto con más de un lote, o este bloque no probaría nada", async () => {
    const f = await productoConVariosLotes();
    expect(f, "no hay ningún producto con dos lotes con existencias: el caso del defecto no está presente").toBeTruthy();
    expect(f.lotes).toBeGreaterThan(1);
  });

  it("getOwnInventory devuelve la SUMA de los lotes", async () => {
    const f = await productoConVariosLotes();
    const { getOwnInventory } = await import("@/modules/nutraceuticals/services/inventory-service");
    const lineas = await getOwnInventory(f.profile_id);
    expect(lineas?.find((l) => l.nutraceuticalId === f.nutraceutical_id)?.stock).toBe(f.total);
  });

  it("getOwnStockByIds devuelve la SUMA de los lotes", async () => {
    const f = await productoConVariosLotes();
    const { getOwnStockByIds } = await import("@/modules/nutraceuticals/services/inventory-service");
    const saldo = await getOwnStockByIds(f.profile_id, [f.nutraceutical_id]);
    expect(saldo[f.nutraceutical_id]).toBe(f.total);
  });
});
