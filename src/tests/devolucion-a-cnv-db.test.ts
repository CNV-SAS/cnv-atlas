import { eq, sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DE LA DEVOLUCION DEL INTEGRANTE A CNV (0187), contra la BD real.
//
// LO QUE PROTEGE, y es una sola idea con cuatro caras: NINGUNA DE LAS DOS PARTES MUEVE SOLA EL SALDO en la
// direccion que le conviene.
//
//   1. Declarar NO baja el saldo. Si lo bajara, un Integrante vaciaria su custodia por su propia palabra, que
//      es justo lo que el caso de faltante existe para impedir.
//   2. Cerrar lo baja, y en las DOS mitades: sale de su vitrina y entra a la central. Un traslado a medias
//      perderia unidades de CNV sin que nada fallara.
//   3. Recibir de MENOS deja la diferencia en el saldo del Integrante (aparecera en su conteo, con plazo para
//      justificar). No se perdona sola.
//   4. No se puede declarar mas de lo que hay, contando lo ya declarado y sin cerrar.
//
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("devolucion del Integrante a CNV (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let writer: any;
  let profId: string;
  let actorId: string;
  let locationId: string;
  let centralId: string;
  let lotId: string;
  const nutraId = "77777777-7777-7777-7777-777777777702"; // MULTICELL, producto dedicado a pruebas
  const devoluciones: string[] = [];

  async function saldo(loc: string): Promise<number> {
    const [f] = await db.execute(dsql`
      select coalesce(stock_quantity, 0)::int as s from nutraceutical_inventory
       where location_id = ${loc} and lot_id = ${lotId}`);
    return f ? Number(f.s) : 0;
  }

  /** Pone el saldo del lote de prueba en N, con un movimiento (el saldo lo mueve el trigger, nunca a mano). */
  async function sembrar(n: number) {
    const actual = await saldo(locationId);
    const delta = n - actual;
    if (delta === 0) return;
    await db.insert(schema.nutraceuticalStockMovements).values({
      professionalId: profId,
      nutraceuticalId: nutraId,
      locationId,
      lotId,
      delta,
      type: "conciliacion",
      reason: "Siembra de la prueba de devoluciones",
      createdBy: actorId,
    });
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    writer = await import("@/modules/nutraceuticals/data/devolucion-a-cnv-writer");

    const [prof] = await db
      .select({ id: schema.professionalProfiles.id, pid: schema.professionalProfiles.profileId })
      .from(schema.professionalProfiles)
      .orderBy(schema.professionalProfiles.createdAt)
      .limit(1);
    profId = prof.id;
    actorId = prof.pid;

    const [loc] = await db.execute(dsql`
      select id from inventory_locations where professional_id = ${profId} limit 1`);
    locationId = loc.id;
    const [central] = await db.execute(dsql`
      select id from inventory_locations where kind = 'central' and is_active limit 1`);
    centralId = central.id;

    // LOTE PROPIO DE LA PRUEBA: tocar un lote del seed dejaria saldo driftado para otro test que lo comparta.
    const [lot] = await db
      .insert(schema.lots)
      .values({ nutraceuticalId: nutraId, code: `TEST-DEV-${Date.now()}`, expiresOn: "2027-12-31" })
      .returning({ id: schema.lots.id });
    lotId = lot.id;
  });

  afterEach(async () => {
    for (const id of devoluciones) {
      await db.execute(dsql`delete from nutraceutical_returns where id = ${id}`);
    }
    devoluciones.length = 0;
    // Se borran los movimientos del lote de prueba y se recomputa el saldo de las dos ubicaciones: el trigger
    // lo proyecta desde los movimientos, asi que sin esto el siguiente caso arranca con basura del anterior.
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from nutraceutical_stock_movements where lot_id = ${lotId}`);
    await db.execute(dsql`
      update nutraceutical_inventory i
         set stock_quantity = coalesce((
               select sum(m.delta) from nutraceutical_stock_movements m
                where m.location_id = i.location_id and m.lot_id = i.lot_id
             ), 0)
       where i.lot_id = ${lotId}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  async function declarar(cantidad: number) {
    const r = await writer.declararDevolucion({
      professionalId: profId,
      locationId,
      nutraceuticalId: nutraId,
      lotId,
      quantity: cantidad,
      reason: "Prueba",
      actorId,
    });
    devoluciones.push(r.id);
    return r.id;
  }

  it("declarar NO baja el saldo: el Integrante no vacia su custodia por su palabra", async () => {
    await sembrar(10);
    await declarar(4);
    expect(await saldo(locationId)).toBe(10);
  });

  it("cerrar lo baja, y en las dos mitades: sale de su vitrina y entra a la central", async () => {
    await sembrar(10);
    const antesCentral = await saldo(centralId);
    const id = await declarar(4);
    await writer.cerrarDevolucion({ returnId: id, recibido: 4, nota: null, actorId, actorEmail: null, ip: null });
    expect(await saldo(locationId)).toBe(6);
    expect(await saldo(centralId)).toBe(antesCentral + 4);
  });

  it("recibir de MENOS deja la diferencia en el saldo del Integrante", async () => {
    await sembrar(10);
    const id = await declarar(4);
    await writer.cerrarDevolucion({ returnId: id, recibido: 1, nota: null, actorId, actorEmail: null, ip: null });
    // Bajan 1, no 4: las tres que no llegaron siguen siendo suyas y apareceran en su conteo.
    expect(await saldo(locationId)).toBe(9);
  });

  it("cerrar con cero no mueve nada, y es un cierre valido", async () => {
    await sembrar(10);
    const id = await declarar(4);
    const r = await writer.cerrarDevolucion({ returnId: id, recibido: 0, nota: "No llegó", actorId, actorEmail: null, ip: null });
    expect(r.movidas).toBe(0);
    expect(await saldo(locationId)).toBe(10);
    const [fila] = await db
      .select({ rec: schema.nutraceuticalReturns.receivedQuantity, cerrada: schema.nutraceuticalReturns.closedAt })
      .from(schema.nutraceuticalReturns)
      .where(eq(schema.nutraceuticalReturns.id, id));
    // Cerrada con cero NO es lo mismo que seguir abierta, y por eso se puede registrar.
    expect(Number(fila.rec)).toBe(0);
    expect(fila.cerrada).not.toBeNull();
  });

  it("recibir de MAS se capa a lo declarado", async () => {
    await sembrar(10);
    const id = await declarar(4);
    const r = await writer.cerrarDevolucion({ returnId: id, recibido: 9, nota: null, actorId, actorEmail: null, ip: null });
    expect(r.movidas).toBe(4);
    expect(await saldo(locationId)).toBe(6);
  });

  it("no se puede declarar mas de lo que hay", async () => {
    await sembrar(3);
    await expect(declarar(5)).rejects.toThrow(/Solo tienes 3/);
  });

  // LA SEGUNDA DECLARACION CUENTA LA PRIMERA: sin esto podria declarar dos veces las mismas unidades y, al
  // cerrarlas ambas, su saldo quedaria negativo, que es una cifra que no significa nada.
  it("lo ya declarado y sin cerrar se descuenta de lo que puede declarar", async () => {
    await sembrar(5);
    await declarar(4);
    await expect(declarar(2)).rejects.toThrow(/Solo tienes 1/);
  });

  it("una devolucion cerrada no se vuelve a cerrar", async () => {
    await sembrar(10);
    const id = await declarar(2);
    await writer.cerrarDevolucion({ returnId: id, recibido: 2, nota: null, actorId, actorEmail: null, ip: null });
    await expect(
      writer.cerrarDevolucion({ returnId: id, recibido: 2, nota: null, actorId, actorEmail: null, ip: null }),
    ).rejects.toThrow(/ya estaba cerrada/i);
  });

  it("lo declarado no se edita despues", async () => {
    await sembrar(10);
    const id = await declarar(2);
    let mensaje = "";
    try {
      await db
        .update(schema.nutraceuticalReturns)
        .set({ declaredQuantity: 9 })
        .where(eq(schema.nutraceuticalReturns.id, id));
    } catch (e) {
      const err = e as { message?: string; cause?: { message?: string } };
      mensaje = `${err.cause?.message ?? ""} ${err.message ?? ""}`;
    }
    expect(mensaje).toMatch(/no se edita/i);
  });
});
