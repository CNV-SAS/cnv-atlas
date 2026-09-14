import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ═══ ANULAR UN LINK, SELLAR DESDE `failed` Y LA REVISION (Bloque 3, sesion 2) ═══
//
// Contra la BASE REAL: lo que se protege son estados de la venta, bloqueos de fila, CHECKs de la 0140 y las
// consultas de las colas de factura y descuento. Un mock de cualquiera de esas cosas diria lo que el mock
// quiera.
//
// Cada caso usa un producto de prueba nuevo, con su lote y su saldo (misma forma que venta-inventario).

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
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
const PERFIL_ADMIN_DEMO = "11111111-1111-1111-1111-111111111111";
let organizationId = "";
let patientId = "";
let locationId = "";
let actorId = "";

async function producto(cantidad: number) {
  const { db } = await import("@/db");
  const productoId = randomUUID();
  await db.execute(dsql`
    insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership)
    values (${productoId}, ${organizationId}, ${`TEST ANULAR ${productoId.slice(0, 8)}`}, 107100, true, 'propio')`);
  const [lote] = await db.execute<{ id: string }>(dsql`
    insert into lots (nutraceutical_id, code, expires_on)
    values (${productoId}, ${`LA-${productoId.slice(0, 6)}`}, '2027-06-01'::date) returning id`);
  await db.execute(dsql`
    insert into nutraceutical_stock_movements
      (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
    values (${PROF}, ${productoId}, ${locationId}, ${lote.id}, ${cantidad}, 'recepcion', 'Fixture de anulacion')`);
  return productoId;
}

async function checkout(productoId: string, cantidad = 1) {
  const { createTransactionWithItems } = await import("@/modules/payments/data/payments-writer");
  return createTransactionWithItems({
    organizationId,
    patientId,
    professionalId: PROF,
    amount: 107100 * cantidad,
    currency: "COP",
    idempotencyKey: `test-anular-${randomUUID()}`,
    items: [{ nutraceuticalId: productoId, quantity: cantidad, unitPrice: 107100 }],
  });
}

async function venta(id: string) {
  const { db } = await import("@/db");
  const [t] = await db.execute<{
    status: string;
    stock_state: string | null;
    fulfillment_state: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
    review_reason: string | null;
    review_resolution: string | null;
    comisiones: number;
    ingresos: number;
    reservas_vivas: number;
  }>(dsql`
    select t.status, t.stock_state, t.fulfillment_state, t.cancelled_at, t.cancelled_by,
           t.review_reason, t.review_resolution,
           (select count(*)::int from professional_revenue pr where pr.transaction_id = t.id) as comisiones,
           (select count(*)::int from cnv_revenue c where c.transaction_id = t.id) as ingresos,
           (select count(*)::int from inventory_reservations r join transaction_items ti on ti.id = r.transaction_item_id
             where ti.transaction_id = t.id and r.released_at is null and r.consumed_at is null) as reservas_vivas
      from transactions t where t.id = ${id}`);
  return t;
}

async function pagar(id: string) {
  const { sealPaidTransaction } = await import("@/modules/payments/data/payments-writer");
  return sealPaidTransaction(id, `wompi-${randomUUID()}`, "CARD", "CREDIT", null);
}

async function enColaDeFactura(id: string) {
  const { listarFacturasPendientes } = await import("@/modules/payments/data/facturacion-repository");
  await (await import("@/db")).db.execute(dsql`
    update transactions set alegra_invoice_state = 'pendiente' where id = ${id} and alegra_invoice_state is null`);
  return (await listarFacturasPendientes(5, 1000)).some((f) => f.id === id);
}

describe.skipIf(!HAS_DB)("anular link, sellar desde failed y la revision (BD real)", () => {
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
    const [perfil] = await db.execute<{ id: string }>(dsql`
      select id from profiles where id = ${PERFIL_ADMIN_DEMO}
      union all select id from profiles limit 1`);
    actorId = perfil.id;
  });

  it("toda venta nueva nace con la entrega PENDIENTE", async () => {
    const p = await producto(3);
    const { id } = await checkout(p);
    expect((await venta(id)).fulfillment_state).toBe("pendiente");
  });

  // ── ANULAR ─────────────────────────────────────────────────────────────────────────────────────
  it("anular un link: queda failed con quien y cuando, y sus unidades se liberan", async () => {
    const { anularCheckout } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const { id } = await checkout(p, 2);
    expect((await venta(id)).reservas_vivas).toBe(1);

    expect(await anularCheckout(id, actorId)).toBe("anulado");
    const v = await venta(id);
    expect(v.status).toBe("failed");
    expect(v.cancelled_at).not.toBeNull();
    expect(v.cancelled_by).toBe(actorId);
    expect(v.stock_state).toBe("liberado");
    expect(v.reservas_vivas).toBe(0);

    // Las unidades vuelven a estar disponibles: otro checkout por las tres pasa.
    await expect(checkout(p, 3)).resolves.toBeTruthy();
  });

  it("no se anula dos veces, ni una venta pagada", async () => {
    const { anularCheckout } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const a = await checkout(p);
    await anularCheckout(a.id, actorId);
    expect(await anularCheckout(a.id, actorId)).toBe("no_estaba_pendiente");

    const b = await checkout(p);
    await pagar(b.id);
    expect(await anularCheckout(b.id, actorId)).toBe("no_estaba_pendiente");
    expect((await venta(b.id)).status).toBe("paid");
  });

  // ── SELLAR DESDE `failed` ──────────────────────────────────────────────────────────────────────
  it("RECHAZADO y despues APROBADO: se sella con su contabilidad, y el inventario vuelve a pendiente y se descuenta", async () => {
    const { markTransactionFailed } = await import("@/modules/payments/data/payments-writer");
    const { liberarReservasDeVenta, descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const p = await producto(3);
    const { id } = await checkout(p);
    await markTransactionFailed(id, "wompi-rechazo");
    await liberarReservasDeVenta(id);
    expect((await venta(id)).stock_state).toBe("liberado");

    const sellada = await pagar(id);
    expect(sellada?.enRevision).toBe(false);
    const v = await venta(id);
    expect(v.status).toBe("paid");
    expect(v.review_reason).toBeNull();
    expect(v.stock_state).toBe("pendiente");
    expect(v.comisiones).toBe(1);
    expect(v.ingresos).toBe(1);

    expect((await descontarVenta(id)).movio).toBe(true);
    expect((await venta(id)).stock_state).toBe("descontado");
  });

  it("APROBADO sobre un link ANULADO: sellado y en revision, SIN contabilidad, sin descuento y fuera de las colas", async () => {
    const { anularCheckout } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta, listarDescuentosPendientes } = await import("@/modules/payments/data/inventario-de-venta");
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const p = await producto(3);
    const { id } = await checkout(p);
    await anularCheckout(id, actorId);

    const sellada = await pagar(id);
    expect(sellada?.enRevision).toBe(true);
    const v = await venta(id);
    expect(v.status).toBe("paid");
    expect(v.review_reason).toBe("pago_sobre_link_anulado");
    expect(v.comisiones).toBe(0);
    expect(v.ingresos).toBe(0);
    expect(v.stock_state).toBe("liberado");

    // Ni el descuento, ni la cola del descuento, ni la de facturas, ni el boton de reintentar la tocan.
    expect((await descontarVenta(id)).movio).toBe(false);
    await (await import("@/db")).db.execute(dsql`update transactions set stock_state = 'pendiente' where id = ${id}`);
    expect((await descontarVenta(id)).movio, "una venta en revision se desconto porque su estado lo parecia").toBe(false);
    expect(await listarDescuentosPendientes(1000)).not.toContain(id);
    expect(await enColaDeFactura(id)).toBe(false);
    expect(await reclamarParaFacturar(id)).toBe(false);
  });

  it("CONTROL: el mismo pago sobre un link PENDIENTE se sella normal y si entra en la cola de facturas", async () => {
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const p = await producto(3);
    const { id } = await checkout(p);
    const sellada = await pagar(id);
    expect(sellada?.enRevision).toBe(false);
    const v = await venta(id);
    expect(v.review_reason).toBeNull();
    expect(v.comisiones).toBe(1);
    expect(await enColaDeFactura(id)).toBe(true);
    expect(await reclamarParaFacturar(id)).toBe(true);
  });

  it("un segundo APPROVED no vuelve a sellar", async () => {
    const p = await producto(3);
    const { id } = await checkout(p);
    expect(await pagar(id)).not.toBeNull();
    expect(await pagar(id)).toBeNull();
    expect((await venta(id)).comisiones).toBe(1);
  });

  // ── LA REVISION ────────────────────────────────────────────────────────────────────────────────
  async function enRevision() {
    const { anularCheckout } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const { id } = await checkout(p);
    await anularCheckout(id, actorId);
    await pagar(id);
    return id;
  }

  it("SEGUNDA COMPRA: se sella la contabilidad retenida, el inventario se descuenta y entra a facturar", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const id = await enRevision();

    expect(await resolverRevision(id, "segunda_compra", actorId)).not.toBeNull();
    const v = await venta(id);
    expect(v.review_resolution).toBe("segunda_compra");
    expect(v.comisiones).toBe(1);
    expect(v.ingresos).toBe(1);
    expect(v.stock_state).toBe("pendiente");
    expect((await descontarVenta(id)).movio).toBe(true);
    expect(await enColaDeFactura(id)).toBe(true);
  });

  it("DEVUELTO: la venta pasa a reembolsada, sin contabilidad, sin descuento y sin factura", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await enRevision();

    expect(await resolverRevision(id, "devuelto", actorId)).not.toBeNull();
    const v = await venta(id);
    expect(v.status).toBe("refunded");
    expect(v.review_resolution).toBe("devuelto");
    expect(v.comisiones).toBe(0);
    expect((await descontarVenta(id)).movio).toBe(false);
    expect(await reclamarParaFacturar(id)).toBe(false);
  });

  it("no se resuelve dos veces, ni una venta que no esta en revision", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const id = await enRevision();
    await resolverRevision(id, "segunda_compra", actorId);
    expect(await resolverRevision(id, "devuelto", actorId)).toBeNull();

    const p = await producto(3);
    const normal = await checkout(p);
    await pagar(normal.id);
    expect(await resolverRevision(normal.id, "segunda_compra", actorId)).toBeNull();
  });

  // ── EFECTIVO CON UN LINK PENDIENTE (decision (b)) ───────────────────────────────────────────────
  async function efectivo(productoId: string, cantidad: number, anular: boolean) {
    const { createPaidCashTransaction } = await import("@/modules/payments/data/payments-writer");
    return createPaidCashTransaction({
      organizationId,
      patientId,
      professionalId: PROF,
      amount: 107100 * cantidad,
      currency: "COP",
      idempotencyKey: `test-efectivo-${randomUUID()}`,
      items: [{ nutraceuticalId: productoId, quantity: cantidad, unitPrice: 107100 }],
      anularLinksQueComparten: anular,
      actorId,
    });
  }

  it("la tarjeta no paso y paga en EFECTIVO: el link del mismo producto se anula y sus unidades son las que se venden", async () => {
    const { detalleDeLinksPendientes } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const p = await producto(2);
    const link = await checkout(p, 2); // reserva las DOS unidades que hay

    const detalle = await detalleDeLinksPendientes(patientId, [p]);
    expect(detalle.map((d) => d.id)).toEqual([link.id]);
    expect(detalle[0].productos).toContain("x2");

    const cash = await efectivo(p, 2, true);
    expect(cash.linksAnulados).toEqual([link.id]);
    const l = await venta(link.id);
    expect(l.status).toBe("failed");
    expect(l.cancelled_by).toBe(actorId);
    expect(l.reservas_vivas).toBe(0);
    expect((await descontarVenta(cash.id)).estado).toBe("descontado");
  });

  it("CONTROL: sin anular, el link muerto retiene las unidades y la venta en efectivo queda sin_saldo sin serlo", async () => {
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const p = await producto(2);
    const link = await checkout(p, 2);
    const cash = await efectivo(p, 2, false);
    expect(cash.linksAnulados).toEqual([]);
    expect((await venta(link.id)).status).toBe("pending");
    expect((await descontarVenta(cash.id)).estado).toBe("sin_saldo");
  });

  it("un link pendiente de OTRO producto no se anula", async () => {
    const p = await producto(2);
    const otro = await producto(2);
    const link = await checkout(otro, 1);
    const cash = await efectivo(p, 1, true);
    expect(cash.linksAnulados).toEqual([]);
    expect((await venta(link.id)).status).toBe("pending");
  });

  // ── LOS CHECK DE LA 0140 ───────────────────────────────────────────────────────────────────────
  it("la base rechaza una entrega sin fecha y una resolucion sin motivo", async () => {
    const { db } = await import("@/db");
    const p = await producto(3);
    const { id } = await checkout(p);
    await expect(
      db.execute(dsql`update transactions set fulfillment_state = 'entregado' where id = ${id}`),
    ).rejects.toThrow();
    await expect(
      db.execute(dsql`update transactions set review_resolution = 'devuelto', reviewed_at = now() where id = ${id}`),
    ).rejects.toThrow();
    // CONTROL: con fecha, la entrega si pasa.
    await expect(
      db.execute(dsql`update transactions set fulfillment_state = 'entregado', delivered_at = now() where id = ${id}`),
    ).resolves.toBeTruthy();
  });
});
