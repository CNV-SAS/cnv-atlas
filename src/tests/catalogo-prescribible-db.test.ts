import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { filtroCatalogoPrescribible } from "@/modules/treatment/catalogo-prescribible";

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
  it("el de prueba a la venta solo se le ofrece a una cuenta de prueba; el retirado a nadie", async () => {
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
    const ve = async (esDePrueba: boolean) => {
      const { data, error } = await cliente
        .from("nutraceuticals")
        .select("id")
        .in("id", Object.values(ids))
        .or(filtroCatalogoPrescribible(esDePrueba));
      expect(error).toBeNull();
      return new Set((data ?? []).map((r) => r.id));
    };

    // ── UNA CUENTA DE PRUEBA ve lo de siempre: el de prueba A LA VENTA si, el retirado no ──
    const deCuentaDePrueba = await ve(true);
    expect(deCuentaDePrueba.has(ids.pruebaRetirado)).toBe(false);
    expect(deCuentaDePrueba.has(ids.pruebaALaVenta)).toBe(true);
    expect(deCuentaDePrueba.has(ids.realNoDisponible)).toBe(true);

    // ═══ Y UNA CUENTA REAL NO VE NINGUNO DE PRUEBA (Santiago, 2026-10-04) ═══
    //
    // ESTO CAMBIO una decision del 2026-10-02, y el cambio es suyo: entonces se dejo el producto del smoke
    // vendible para que el carril de pruebas sirviera. Al pasar el smoke a correr con un producto REAL, esa
    // excepcion dejo de comprar nada y solo dejaba la puerta abierta: un Integrante real podia venderle a un
    // paciente un producto que NO EXISTE.
    //
    // Y EL SALDO NO ABRE LA PUERTA: se penso "si lo recibio, que pueda venderlo", y no vale aqui, porque el
    // saldo de un producto que no existe es tan ficticio como el producto. Contar y vender son dos preguntas:
    // el inventario lo SIGUE mostrando con su saldo (para no contradecir el conteo fisico) y la venta no.
    const deCuentaReal = await ve(false);
    expect(deCuentaReal.has(ids.pruebaRetirado)).toBe(false);
    expect(
      deCuentaReal.has(ids.pruebaALaVenta),
      "una cuenta real vuelve a ver el producto de prueba: podria venderle a un paciente algo que no existe",
    ).toBe(false);
    expect(deCuentaReal.has(ids.realNoDisponible), "se dejo de ofrecer un producto REAL").toBe(true);

    // CONTROL: sin el filtro, los tres vuelven. Sin esto, un filtro que no devuelve nada pasaria los casos.
    const sin = await cliente.from("nutraceuticals").select("id").in("id", Object.values(ids));
    expect(sin.data).toHaveLength(3);
  });
});
