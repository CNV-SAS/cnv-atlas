import { createClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
  // ═══ EL FIXTURE ES PROPIO, NO PRESTADO (2026-09-19) ═══
  //
  // Antes elegia "cualquier producto de la base que tenga dos lotes", y eso lo ataba a datos que OTROS
  // tests de la suite mueven mientras este corre: el fixture leia 150, el lector leia 40 a mitad de un
  // despacho ajeno, y el caso se caia por una carrera, no por un defecto. La firma era inconfundible:
  // fallaba en la suite completa y pasaba corriendo el archivo solo.
  //
  // AHORA SE CREA LO SUYO: un producto propio, dos lotes, dos filas de inventario, y se borra al final.
  // Nadie mas lo toca, asi que el numero esperado es fijo y el caso vuelve a hablar SOLO del lector.
  //
  // Y SIGUE SIENDO EL CASO DEL DEFECTO: dos filas del MISMO producto y el MISMO profesional, que es lo
  // que la 0121 hizo posible al mover la llave a (ubicacion, producto, lote) y lo que hacia que el
  // ultimo lote pisara al anterior.
  const NOMBRE_FIXTURE = "ZZ FIXTURE saldo-por-lote";
  const LOTES = [40, 110];
  const TOTAL = LOTES.reduce((a, b) => a + b, 0);

  let profileId = "";
  let professionalId = "";
  let nutraceuticalId = "";

  beforeAll(async () => {
    const { db } = await import("@/db");
    // Un profesional REAL de la base (con su ubicacion): crear uno exigiria perfil, organizacion y
    // cuenta, y lo que este test necesita del profesional es solo que exista y tenga donde guardar.
    const [prof] = await db.execute<{ id: string; profile_id: string; location_id: string }>(dsql`
      select pp.id, pp.profile_id, l.id as location_id
        from professional_profiles pp
        join inventory_locations l on l.professional_id = pp.id
       where pp.profile_id is not null
         and (select count(*) from professional_profiles o where o.profile_id = pp.profile_id) = 1
       limit 1`);
    if (!prof) return;
    professionalId = prof.id;
    profileId = prof.profile_id;

    const [existente] = await db.execute<{ id: string }>(
      dsql`select id from nutraceuticals where name = ${NOMBRE_FIXTURE} limit 1`,
    );
    if (existente) {
      nutraceuticalId = existente.id;
      return;
    }

    const [nutra] = await db.execute<{ id: string }>(dsql`
      insert into nutraceuticals (organization_id, name, commercial_availability, is_test)
      select p.organization_id, ${NOMBRE_FIXTURE}, 'en_consultorio', true
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where pp.id = ${professionalId}
      returning id`);
    nutraceuticalId = nutra.id;

    for (const [i, cantidad] of LOTES.entries()) {
      const [lote] = await db.execute<{ id: string }>(dsql`
        insert into lots (nutraceutical_id, code, expires_on)
        values (${nutraceuticalId}, ${`FIXTURE-SALDO-${i}`}, current_date + 365)
        returning id`);
      // EL SALDO NO SE ESCRIBE A MANO: un trigger obliga a que sea la suma de los MOVIMIENTOS, y hace
      // bien (el saldo es una proyeccion, no una fuente). Asi que el fixture registra la recepcion y deja
      // que el saldo lo ponga la base, igual que en la aplicacion.
      await db.execute(dsql`
        insert into nutraceutical_stock_movements
          (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason)
        values (${professionalId}, ${nutraceuticalId}, ${prof.location_id}, ${lote.id}, 'recepcion', ${cantidad}, 'fixture saldo-por-lote')`);
    }
  });

  // NO SE LIMPIA, Y ES DELIBERADO: los movimientos de inventario son APPEND-ONLY por trigger (registro
  // de custodia: un error se corrige con un movimiento inverso, no borrando). Por eso el fixture es un
  // producto ESTABLE que se reusa entre corridas en vez de uno nuevo cada vez, que acumularia basura.
  it("CONTROL: el producto de prueba quedó con DOS lotes con existencias", async () => {
    const { db } = await import("@/db");
    const [f] = await db.execute<{ lotes: number; total: number }>(dsql`
      select count(*)::int as lotes, sum(stock_quantity)::int as total
        from nutraceutical_inventory
       where nutraceutical_id = ${nutraceuticalId}`);
    expect(f?.lotes, "sin dos lotes, este bloque no probaría nada").toBe(LOTES.length);
    expect(f?.total).toBe(TOTAL);
  });

  it("getOwnInventory devuelve la SUMA de los lotes", async () => {
    const { getOwnInventory } = await import("@/modules/nutraceuticals/services/inventory-service");
    const lineas = await getOwnInventory(profileId);
    expect(lineas?.find((l) => l.nutraceuticalId === nutraceuticalId)?.stock).toBe(TOTAL);
  });

  it("getOwnStockByIds devuelve la SUMA de los lotes", async () => {
    const { getOwnStockByIds } = await import("@/modules/nutraceuticals/services/inventory-service");
    const saldo = await getOwnStockByIds(profileId, [nutraceuticalId]);
    expect(saldo[nutraceuticalId]).toBe(TOTAL);
  });
});
