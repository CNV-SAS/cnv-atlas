import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// ═══ EL INVENTARIO DEL TABLERO DE DIRECCION (smoke del Bloque 3, 2026-09-14) ═══
//
// Decia "1828 unidades · 45 referencias". Las 45 eran FILAS de saldo (ubicacion por producto por lote) y 18 de
// las unidades eran de productos de prueba. La nube tenia 1.810 unidades reales de 5 productos en 8 ubicaciones.
// El lector real, contra PostgREST de verdad: el embed `nutraceuticals!inner` es de la familia que tsc no ve.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

vi.mock("@/lib/supabase/server", () => ({
  // Service role SOLO en el test: se prueba la cuenta del lector, no la RLS.
  createSupabaseServerClient: async () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    }),
}));

describe.skipIf(!HAS_DB)("inventario del tablero de Direccion (BD real)", () => {
  it("un producto de prueba con saldo no suma unidades, ni productos, ni ubicaciones", async () => {
    const { db } = await import("@/db");
    const { getDireccionDashboard } = await import("@/modules/direccion/data/dashboard-reader");
    const antes = await getDireccionDashboard();

    const [loc] = await db.execute<{ id: string; professional_id: string | null }>(
      dsql`select id, professional_id from inventory_locations where is_active order by created_at limit 1`,
    );
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const prod = randomUUID();
    await db.execute(dsql`
      insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership, commercial_availability)
      values (${prod}, ${org.id}, ${`TABLERO PRUEBA ${prod.slice(0, 8)}`}, 11900, true, 'propio', 'no_disponible')`);
    const [lote] = await db.execute<{ id: string }>(dsql`
      insert into lots (nutraceutical_id, code, expires_on) values (${prod}, 'TAB-1', '2027-01-01') returning id`);
    await db.execute(dsql`
      insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
      values (${loc.professional_id}, ${prod}, ${loc.id}, ${lote.id}, 7, 'recepcion', 'Fixture del tablero')`);

    const despues = await getDireccionDashboard();
    expect(despues.inventoryUnits).toBe(antes.inventoryUnits);
    expect(despues.inventoryProducts).toBe(antes.inventoryProducts);

    // CONTROL: el mismo saldo en un producto REAL si suma.
    await db.execute(dsql`update nutraceuticals set is_test = false where id = ${prod}`);
    const real = await getDireccionDashboard();
    expect(real.inventoryUnits).toBe(antes.inventoryUnits + 7);
    expect(real.inventoryProducts).toBe(antes.inventoryProducts + 1);
    await db.execute(dsql`update nutraceuticals set is_test = true where id = ${prod}`);
  });

  // ═══ EL DESGLOSE TIENE QUE CUADRAR CON SU PROPIA CIFRA (Santiago, 2026-09-30) ═══
  //
  // "6 productos en 9 ubicaciones" y la pregunta inmediata era cuales. Ahora se puede abrir, y al abrirlo
  // aparece el riesgo nuevo: que el desglose y el total discrepen. Aqui no pueden, porque salen de las
  // mismas filas, y esto es lo que lo mantiene asi.
  //
  // Y ADEMAS PRUEBA EL EMBED, que es de la familia que tsc no ve: `inventory_locations!inner(name)` es un
  // segundo embed sobre la misma consulta, y una relacion ambigua solo revienta contra PostgREST de verdad.
  it("el desglose cuadra con el total, y sus dos ejes con sus conteos", async () => {
    const { getDireccionDashboard } = await import("@/modules/direccion/data/dashboard-reader");
    const d = await getDireccionDashboard();

    const porProducto = d.inventoryByProduct.reduce((n, p) => n + p.unidades, 0);
    const porUbicacion = d.inventoryByLocation.reduce((n, l) => n + l.unidades, 0);
    // ═══ LA IGUALDAD ES EXACTA, y este caso ya la gano una vez ═══
    //
    // La primera version pedia solo "menor o igual" porque supuse que el desglose dejaba fuera filas que el
    // total contaba. Al correrlo dio 7.197 contra 7.187: el desglose sumaba MAS, porque dejaba fuera las
    // filas NEGATIVAS y el total si las cuenta. O sea que la tarjeta y su propio desglose podian discrepar,
    // que es justo lo que el desglose venia a evitar. Ahora incluye todo lo que no es cero y la suma cuadra
    // al peso, que es lo unico que hace imposible la discrepancia.
    expect(porProducto).toBe(porUbicacion);
    expect(porProducto).toBe(d.inventoryUnits);
    // Los CONTEOS de la tarjeta miran solo saldo positivo, asi que el desglose puede tener alguna linea mas
    // (una con saldo negativo). Menos, nunca.
    expect(d.inventoryByProduct.length).toBeGreaterThanOrEqual(d.inventoryProducts);
    expect(d.inventoryByLocation.length).toBeGreaterThanOrEqual(d.inventoryLocations);
    // Nombres de verdad: si el embed dejara de traerlos, todas las lineas dirian "(sin nombre)" y la
    // pantalla seguiria pareciendo correcta.
    for (const p of d.inventoryByProduct) expect(p.nombre).not.toBe("(sin nombre)");
    for (const l of d.inventoryByLocation) expect(l.nombre).not.toBe("(sin nombre)");
  });
});
