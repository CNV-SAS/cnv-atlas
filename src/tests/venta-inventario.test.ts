import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ═══ LA VENTA MUEVE INVENTARIO (Bloque 3, sesion 1) ═══
//
// Contra la BASE REAL, porque lo que se protege vive en ella: los triggers del saldo por lote, el bloqueo de
// filas que serializa dos reservas, y el orden de dos transacciones (el pago primero, el inventario despues).
// Un mock diria lo que el mock quiera.
//
// CADA CASO USA UN PRODUCTO DE PRUEBA NUEVO, con sus lotes y su saldo, para que ningun caso dependa del
// saldo que dejo otro. Los movimientos son inmutables por trigger y las ventas que movieron inventario no se
// pueden borrar (FK RESTRICT, a proposito), asi que los datos de prueba se quedan en la base local marcados
// como de prueba; es lo mismo que ya hacen los tests de inventario.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
// La factura no es lo que se prueba aqui y llamaria a Alegra: se simula solo su emision. `motivoLegible` se
// conserva con su forma, porque el servicio de inventario lo usa para escribir el motivo del fallo.
vi.mock("@/modules/payments/services/facturacion-service", () => ({
  emitirFacturaDeVenta: vi.fn(),
  motivoLegible: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const PROF = "33333333-3333-3333-3333-333333333333"; // profesional demo, con ubicacion propia
let organizationId = "";
let patientId = "";
let locationId = "";

async function productoConLotes(lotes: { vence: string; cantidad: number }[]) {
  const { db } = await import("@/db");
  const productoId = randomUUID();
  await db.execute(dsql`
    insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership)
    values (${productoId}, ${organizationId}, ${`TEST VENTA ${productoId.slice(0, 8)}`}, 107100, true, 'propio')`);
  const ids: string[] = [];
  for (const [i, l] of lotes.entries()) {
    const [lote] = await db.execute<{ id: string }>(dsql`
      insert into lots (nutraceutical_id, code, expires_on)
      values (${productoId}, ${`L${i}-${productoId.slice(0, 6)}`}, ${l.vence}::date) returning id`);
    ids.push(lote.id);
    if (l.cantidad > 0) {
      await db.execute(dsql`
        insert into nutraceutical_stock_movements
          (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
        values (${PROF}, ${productoId}, ${locationId}, ${lote.id}, ${l.cantidad}, 'recepcion', 'Fixture de venta')`);
    }
  }
  return { productoId, lotes: ids };
}

async function saldo(productoId: string) {
  const { db } = await import("@/db");
  const filas = await db.execute<{ lot_id: string; stock_quantity: number }>(dsql`
    select lot_id, stock_quantity from nutraceutical_inventory
     where location_id = ${locationId} and nutraceutical_id = ${productoId}`);
  return new Map(filas.map((f) => [f.lot_id, Number(f.stock_quantity)]));
}

async function checkout(productoId: string, cantidad: number) {
  const { createTransactionWithItems } = await import("@/modules/payments/data/payments-writer");
  return createTransactionWithItems({
    organizationId,
    patientId,
    professionalId: PROF,
    amount: 107100 * cantidad,
    currency: "COP",
    idempotencyKey: `test-venta-${randomUUID()}`,
    items: [{ nutraceuticalId: productoId, quantity: cantidad, unitPrice: 107100 }],
  });
}

async function venta(id: string) {
  const { db } = await import("@/db");
  const [t] = await db.execute<{
    status: string;
    stock_state: string | null;
    stock_last_error: string | null;
    location_id: string | null;
    wompi_env: string;
  }>(dsql`select status, stock_state, stock_last_error, location_id, wompi_env from transactions where id = ${id}`);
  return t;
}

async function reservas(id: string) {
  const { db } = await import("@/db");
  return db.execute<{ lot_id: string; quantity: number; released_at: string | null; consumed_at: string | null }>(dsql`
    select r.lot_id, r.quantity, r.released_at, r.consumed_at
      from inventory_reservations r join transaction_items ti on ti.id = r.transaction_item_id
     where ti.transaction_id = ${id} order by r.lot_id`);
}

async function movimientosDeVenta(id: string) {
  const { db } = await import("@/db");
  return db.execute<{ lot_id: string; delta: number; type: string }>(dsql`
    select m.lot_id, m.delta, m.type
      from nutraceutical_stock_movements m join transaction_items ti on ti.id = m.transaction_item_id
     where ti.transaction_id = ${id} order by m.lot_id`);
}

async function pagar(id: string, ambiente: "test" | "prod" | null = null) {
  const { sealPaidTransaction } = await import("@/modules/payments/data/payments-writer");
  return sealPaidTransaction(id, `wompi-${randomUUID()}`, "CARD", "CREDIT", ambiente);
}

describe.skipIf(!HAS_DB)("la venta mueve inventario (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    organizationId = org.id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [loc] = await db.execute<{ id: string }>(
      dsql`select id from inventory_locations where professional_id = ${PROF} and is_active limit 1`,
    );
    locationId = loc.id;
  });

  // ── RESERVAR ─────────────────────────────────────────────────────────────────────────────────
  it("el checkout RESERVA por FEFO y no mueve el saldo", async () => {
    const p = await productoConLotes([
      { vence: "2027-03-01", cantidad: 2 },
      { vence: "2027-06-01", cantidad: 5 },
    ]);
    const { id } = await checkout(p.productoId, 3);

    expect((await reservas(id)).map((r) => [r.lot_id, Number(r.quantity)])).toEqual(
      [
        [p.lotes[0], 2],
        [p.lotes[1], 1],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    const s = await saldo(p.productoId);
    expect([s.get(p.lotes[0]), s.get(p.lotes[1])], "la reserva movió el saldo").toEqual([2, 5]);
    expect(await venta(id)).toMatchObject({ status: "pending", stock_state: "reservado", location_id: locationId });
  });

  it("SIN EXISTENCIAS NO HAY CHECKOUT, y la venta no queda creada a medias", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 4 }]);
    await checkout(p.productoId, 3); // quedan 1 disponible

    const { InventarioDeVentaError } = await import("@/modules/payments/data/inventario-de-venta");
    await expect(checkout(p.productoId, 2)).rejects.toBeInstanceOf(InventarioDeVentaError);
    await expect(checkout(p.productoId, 2)).rejects.toThrow(/Solo hay 1 unidad/);

    const [n] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from transaction_items where nutraceutical_id = ${p.productoId}`);
    expect(Number(n.n), "quedó una venta creada sin su reserva").toBe(1);
  });

  // ── LA BASE NO ADMITE UNA VENTA SIN SU LINEA ──────────────────────────────────────────────────────
  it("un movimiento de VENTA sin línea de venta lo rechaza la base (CHECK de la 0139)", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    // Drizzle envuelve el error de Postgres ("Failed query: ..."); el nombre de la restriccion viaja en
    // `cause`. Se mira ahi, y no el texto del envoltorio, para que el test falle solo por la regla.
    const error = await db
      .execute(dsql`
        insert into nutraceutical_stock_movements
          (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
        values (${PROF}, ${p.productoId}, ${locationId}, ${p.lotes[0]}, -1, 'venta', 'sin linea')`)
      .then(() => null, (e: { cause?: { constraint_name?: string } }) => e);
    expect(error?.cause?.constraint_name, "la base aceptó una venta sin línea").toBe("nutra_movement_venta_exige_linea");
  });

  it("CONTROL: el mismo movimiento como RECEPCION sin línea sí entra (el CHECK es solo de la venta)", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 0 }]);
    await expect(
      db.execute(dsql`
        insert into nutraceutical_stock_movements
          (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
        values (${PROF}, ${p.productoId}, ${locationId}, ${p.lotes[0]}, 1, 'recepcion', 'control')`),
    ).resolves.toBeTruthy();
  });

  // ── DESCONTAR ────────────────────────────────────────────────────────────────────────────────
  it("al PAGAR se descuenta lo reservado, lote por lote, ligado a la línea", async () => {
    const p = await productoConLotes([
      { vence: "2027-03-01", cantidad: 2 },
      { vence: "2027-06-01", cantidad: 5 },
    ]);
    const { id } = await checkout(p.productoId, 3);
    expect(await pagar(id)).not.toBeNull();

    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    expect((await descontarVenta(id)).estado).toBe("descontado");

    const s = await saldo(p.productoId);
    expect([s.get(p.lotes[0]), s.get(p.lotes[1])]).toEqual([0, 4]);
    const movs = await movimientosDeVenta(id);
    expect(movs.every((m) => m.type === "venta")).toBe(true);
    expect(movs.reduce((a, m) => a + Number(m.delta), 0)).toBe(-3);
    expect((await reservas(id)).every((r) => r.consumed_at !== null && r.released_at === null)).toBe(true);
    expect(await venta(id)).toMatchObject({ status: "paid", stock_state: "descontado" });
  });

  it("descontar DOS VECES no descuenta dos veces", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 2);
    await pagar(id);
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    await descontarVenta(id);
    const segunda = await descontarVenta(id);

    expect(segunda.movio).toBe(false);
    expect((await movimientosDeVenta(id)).length).toBe(1);
    expect((await saldo(p.productoId)).get(p.lotes[0])).toBe(3);
  });

  it("un checkout SIN PAGAR no se descuenta nunca", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 2);
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    expect((await descontarVenta(id)).movio).toBe(false);
    expect((await saldo(p.productoId)).get(p.lotes[0])).toBe(5);
  });

  // ── LIBERAR ──────────────────────────────────────────────────────────────────────────────────
  it("si el pago FALLA, las unidades vuelven a estar disponibles", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 3 }]);
    const { id } = await checkout(p.productoId, 3);
    const { markTransactionFailed } = await import("@/modules/payments/data/payments-writer");
    const { liberarReservasDeVenta } = await import("@/modules/payments/data/inventario-de-venta");
    await markTransactionFailed(id, `wompi-${randomUUID()}`);
    await liberarReservasDeVenta(id);

    expect((await reservas(id)).every((r) => r.released_at !== null)).toBe(true);
    expect((await venta(id)).stock_state).toBe("liberado");
    // La prueba de que volvieron: un checkout nuevo por las mismas 3 unidades se puede crear.
    await expect(checkout(p.productoId, 3)).resolves.toHaveProperty("id");
  });

  it("un evento de fallo que llega sobre una venta YA PAGADA no suelta sus unidades", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 3 }]);
    const { id } = await checkout(p.productoId, 3);
    await pagar(id);
    const { liberarReservasDeVenta } = await import("@/modules/payments/data/inventario-de-venta");
    await liberarReservasDeVenta(id);

    expect((await reservas(id)).every((r) => r.released_at === null)).toBe(true);
    await expect(checkout(p.productoId, 1)).rejects.toThrow(/No hay existencias/);
  });

  it("una reserva VENCIDA deja de contar: otra venta puede tomar esas unidades", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 2 }]);
    const primera = await checkout(p.productoId, 2);
    await db.execute(dsql`
      update inventory_reservations r set expires_at = now() - interval '1 minute'
        from transaction_items ti
       where ti.id = r.transaction_item_id and ti.transaction_id = ${primera.id}`);

    const segunda = await checkout(p.productoId, 2);
    expect(segunda.id).toBeTruthy();
    // Y si la primera se paga tarde (el evento llega pasado el vencimiento), se sella igual y avisa: sus
    // unidades ya no estan. Es la decision 4 de Santiago.
    await pagar(primera.id);
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const r = await descontarVenta(primera.id);
    expect(r.estado).toBe("sin_saldo");
    expect((await venta(primera.id)).status).toBe("paid");
  });

  // ── LA DECISION 4: PAGADA SIN SALDO SE SELLA IGUAL Y AVISA ─────────────────────────────────────
  it("una venta en EFECTIVO sin saldo suficiente queda pagada, descuenta lo que hay y dice cuánto faltó", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 2 }]);
    const { createPaidCashTransaction } = await import("@/modules/payments/data/payments-writer");
    const { descontarInventarioDeVenta } = await import("@/modules/payments/services/inventario-venta-service");
    const { id } = await createPaidCashTransaction({
      organizationId,
      patientId,
      professionalId: PROF,
      amount: 107100 * 5,
      currency: "COP",
      idempotencyKey: `test-venta-${randomUUID()}`,
      items: [{ nutraceuticalId: p.productoId, quantity: 5, unitPrice: 107100 }],
    });
    await descontarInventarioDeVenta(id);

    const v = await venta(id);
    expect(v.status).toBe("paid");
    expect(v.stock_state).toBe("sin_saldo");
    expect(v.stock_last_error).toMatch(/faltaron 3/);
    expect((await saldo(p.productoId)).get(p.lotes[0])).toBe(0);
    const [ingreso] = await db.execute(dsql`select 1 from cnv_revenue where transaction_id = ${id}`);
    expect(ingreso, "la venta perdió su contabilidad").toBeTruthy();
  });

  // ── EL PAGO PRIMERO ──────────────────────────────────────────────────────────────────────────
  it("si el descuento FALLA, el pago sigue sellado y la venta queda en la cola con su motivo", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 1);
    await pagar(id);
    // Se provoca un fallo real: la venta pierde su ubicacion, y el descuento no sabe de donde sacar.
    await db.execute(dsql`update transactions set location_id = null where id = ${id}`);
    const { descontarInventarioDeVenta } = await import("@/modules/payments/services/inventario-venta-service");
    const { listarDescuentosPendientes } = await import("@/modules/payments/data/inventario-de-venta");
    await descontarInventarioDeVenta(id); // no lanza

    const v = await venta(id);
    expect(v.status, "un fallo de inventario deshizo el pago").toBe("paid");
    expect(v.stock_state).toBe("fallido");
    expect(v.stock_last_error).toMatch(/ubicación/);
    expect(await listarDescuentosPendientes(1000)).toContain(id);
  });

  // ── EL AMBIENTE DEL PAGO ─────────────────────────────────────────────────────────────────────
  it("el sellado toma el ambiente del EVENTO: un checkout de prueba pagado en producción queda de producción", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 1);
    expect((await venta(id)).wompi_env).toBe("test"); // las llaves locales son de prueba
    await pagar(id, "prod");
    expect((await venta(id)).wompi_env).toBe("produccion");
  });

  it("CONTROL: sin ambiente en el evento, el de la venta no cambia", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 1);
    await pagar(id, null);
    expect((await venta(id)).wompi_env).toBe("test");
  });
});

// ── EL WEBHOOK DE VERDAD: EL ULTIMO CABLE ────────────────────────────────────────────────────────
//
// Las piezas de arriba podrian estar bien y el webhook no llamarlas, o llamarlas en otro orden. Esto pasa por
// `processWompiWebhook`, que es lo que corre en produccion.
describe.skipIf(!HAS_DB)("el webhook de Wompi mueve el inventario (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    organizationId = org.id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [loc] = await db.execute<{ id: string }>(
      dsql`select id from inventory_locations where professional_id = ${PROF} and is_active limit 1`,
    );
    locationId = loc.id;
  });

  const evento = (reference: string, status: string, environment?: "test" | "prod") => ({
    event: "transaction.updated",
    timestamp: Date.now(),
    signature: { checksum: "x", properties: [] },
    ...(environment ? { environment } : {}),
    data: {
      transaction: {
        id: `wompi-${randomUUID()}`,
        reference,
        status,
        amount_in_cents: 10710000,
        currency: "COP",
        payment_method_type: "CARD",
      },
    },
  });

  it("APROBADO: sella el pago, descuenta el inventario y pide la factura, en ese orden", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 1);
    const { processWompiWebhook } = await import("@/modules/payments/services/payments-service");
    const factura = await import("@/modules/payments/services/facturacion-service");

    const r = await processWompiWebhook(evento(id, "APPROVED", "test"));
    expect(r.sealed).toBe(true);
    expect(await venta(id)).toMatchObject({ status: "paid", stock_state: "descontado" });
    expect((await saldo(p.productoId)).get(p.lotes[0])).toBe(4);
    expect(factura.emitirFacturaDeVenta).toHaveBeenCalledWith(expect.objectContaining({ id }));
  });

  it("APROBADO con un descuento que falla: el pago queda sellado igual, y la factura se pide igual", async () => {
    const { db } = await import("@/db");
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 5 }]);
    const { id } = await checkout(p.productoId, 1);
    await db.execute(dsql`update transactions set location_id = null where id = ${id}`);
    const { processWompiWebhook } = await import("@/modules/payments/services/payments-service");
    const factura = await import("@/modules/payments/services/facturacion-service");

    await expect(processWompiWebhook(evento(id, "APPROVED", "prod"))).resolves.toMatchObject({ sealed: true });
    const v = await venta(id);
    expect(v.status, "un fallo de inventario deshizo el pago en el webhook").toBe("paid");
    expect(v.stock_state).toBe("fallido");
    expect(v.wompi_env, "el sellado no tomó el ambiente del evento").toBe("produccion");
    expect(factura.emitirFacturaDeVenta).toHaveBeenCalledWith(expect.objectContaining({ id }));
  });

  it("RECHAZADO: la venta queda fallida y sus unidades vuelven a estar disponibles", async () => {
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 2 }]);
    const { id } = await checkout(p.productoId, 2);
    const { processWompiWebhook } = await import("@/modules/payments/services/payments-service");

    await processWompiWebhook(evento(id, "DECLINED"));
    expect(await venta(id)).toMatchObject({ status: "failed", stock_state: "liberado" });
    await expect(checkout(p.productoId, 2)).resolves.toHaveProperty("id");
  });
});

// ── DOS CHECKOUTS A LA VEZ POR LAS ULTIMAS UNIDADES ──────────────────────────────────────────────
//
// Con el pool CALIENTE, que es lo que el test del reclamo de factura demostro que hace falta para que las
// llamadas compitan de verdad (en frio, postgres.js las pone en fila en una conexion y "pasa" por accidente).
describe.skipIf(!HAS_DB)("la reserva bajo concurrencia (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    organizationId = org.id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [loc] = await db.execute<{ id: string }>(
      dsql`select id from inventory_locations where professional_id = ${PROF} and is_active limit 1`,
    );
    locationId = loc.id;
  });

  it("CONTROL: con el pool caliente, un leer-y-reservar ingenuo SÍ deja pasar a varias", async () => {
    const { db } = await import("@/db");
    await Promise.all(Array.from({ length: 10 }, () => db.execute(dsql`select pg_sleep(0.05)`)));
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 2 }]);
    let reservadas = 0;
    const ingenuo = async () => {
      const [f] = await db.execute<{ stock: number }>(dsql`
        select coalesce(sum(stock_quantity), 0)::int - ${reservadas} as stock from nutraceutical_inventory
         where location_id = ${locationId} and nutraceutical_id = ${p.productoId}`);
      if (Number(f.stock) < 2) return false;
      await new Promise((r) => setTimeout(r, 50)); // la ventana real entre leer y escribir
      reservadas += 2;
      return true;
    };
    const ganadoras = (await Promise.all(Array.from({ length: 10 }, ingenuo))).filter(Boolean);
    expect(ganadoras.length, "el control no reprodujo la carrera: el test de abajo no probaría nada").toBeGreaterThan(1);
  });

  it("DIEZ checkouts a la vez por las 2 últimas unidades: exactamente UNO se crea", async () => {
    const { db } = await import("@/db");
    await Promise.all(Array.from({ length: 10 }, () => db.execute(dsql`select pg_sleep(0.05)`)));
    const p = await productoConLotes([{ vence: "2027-03-01", cantidad: 2 }]);
    const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => checkout(p.productoId, 2)));

    expect(
      resultados.filter((r) => r.status === "fulfilled"),
      "más de un checkout reservó las mismas unidades",
    ).toHaveLength(1);
    const { InventarioDeVentaError } = await import("@/modules/payments/data/inventario-de-venta");
    for (const r of resultados.filter((x) => x.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(InventarioDeVentaError);
    }
  });
});
