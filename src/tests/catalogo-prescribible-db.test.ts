import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { FILTRO_CATALOGO_PRESCRIBIBLE } from "@/modules/treatment/catalogo-prescribible";

// ═══ EL DESPLEGABLE DE PRESCRIPCION NO OFRECE LOS PRODUCTOS DE PRUEBA RETIRADOS (2026-09-14) ═══
//
// Cada smoke del Bloque 3 deja un "PRUEBA SMOKE BLOQUE 3 (retirado ...)" y aparecian en el desplegable de todos
// los profesionales. Contra PostgREST de verdad, porque el filtro es un `or` en su sintaxis y un error ahi no
// lo ve tsc: devolveria todo o nada.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

describe.skipIf(!HAS_DB)("catalogo prescribible (BD real)", () => {
  it("oculta el de prueba retirado, y deja el de prueba a la venta y el real no disponible", async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const sufijo = randomUUID().slice(0, 8);
    const ids = { pruebaRetirado: randomUUID(), pruebaALaVenta: randomUUID(), realNoDisponible: randomUUID() };
    await db.execute(dsql`
      insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership, commercial_availability) values
        (${ids.pruebaRetirado}, ${org.id}, ${`CATALOGO PRUEBA RETIRADO ${sufijo}`}, 11900, true, 'propio', 'no_disponible'),
        (${ids.pruebaALaVenta}, ${org.id}, ${`CATALOGO PRUEBA VENTA ${sufijo}`}, 11900, true, 'propio', 'en_consultorio'),
        (${ids.realNoDisponible}, ${org.id}, ${`CATALOGO REAL NO DISP ${sufijo}`}, 11900, false, 'propio', 'no_disponible')`);

    const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await cliente
      .from("nutraceuticals")
      .select("id")
      .in("id", Object.values(ids))
      .or(FILTRO_CATALOGO_PRESCRIBIBLE);
    expect(error).toBeNull();
    const vistos = new Set((data ?? []).map((r) => r.id));
    expect(vistos.has(ids.pruebaRetirado)).toBe(false);
    expect(vistos.has(ids.pruebaALaVenta)).toBe(true);
    expect(vistos.has(ids.realNoDisponible)).toBe(true);

    // CONTROL: sin el filtro, los tres vuelven.
    const sin = await cliente.from("nutraceuticals").select("id").in("id", Object.values(ids));
    expect(sin.data).toHaveLength(3);
  });
});
