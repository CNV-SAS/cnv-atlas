import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
// Los pagos en revision que dejan los casos se resuelven al final: la lista "por revisar" tiene tope, y una base
// local que acumula revisiones abiertas de corridas anteriores terminaria empujando fuera las del caso nuevo.
const revisionesCreadas: string[] = [];

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

  afterAll(async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { registrarVersionDelIntegrante } = await import("@/modules/payments/data/payments-writer");
    for (const id of revisionesCreadas) {
      await registrarVersionDelIntegrante(id, "Limpieza del test: pago de prueba", actorId);
      await resolverRevision(id, "devuelto", actorId, "TEST-LIMPIEZA");
    }
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
    revisionesCreadas.push(id);
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
  async function enRevision(conVersion = true) {
    const { anularCheckout } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const { id } = await checkout(p);
    await anularCheckout(id, actorId);
    await pagar(id);
    revisionesCreadas.push(id);
    if (conVersion) {
      const { registrarVersionDelIntegrante } = await import("@/modules/payments/data/payments-writer");
      await registrarVersionDelIntegrante(id, "El paciente pago en efectivo y la pagina de Wompi seguia abierta.", actorId);
    }
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

    expect(await resolverRevision(id, "devuelto", actorId, "WOMPI-REEMBOLSO-123")).not.toBeNull();
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
    expect(await resolverRevision(id, "devuelto", actorId, "WOMPI-REEMBOLSO-123")).toBeNull();

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

  // ── LA ENTREGA ─────────────────────────────────────────────────────────────────────────────────
  async function auditoriaDeEntrega(id: string) {
    const { db } = await import("@/db");
    return db.execute<{ actor_id: string; entity_type: string; payload: Record<string, unknown> }>(dsql`
      select actor_id, entity_type, payload from clinical_audit_log
       where event = 'nutraceutical.delivered' and entity_id = ${id}`);
  }

  it("no se entrega una venta sin pagar", async () => {
    const { registrarEntrega } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const { id } = await checkout(p);
    expect(await registrarEntrega(id, { id: actorId, email: null })).toBe("no_pagada");
    expect((await venta(id)).fulfillment_state).toBe("pendiente");
    expect(await auditoriaDeEntrega(id)).toHaveLength(0);
  });

  it("una venta pagada se entrega UNA vez, y queda en la auditoria clinica sin datos del paciente", async () => {
    const { registrarEntrega } = await import("@/modules/payments/data/payments-writer");
    const p = await producto(3);
    const { id } = await checkout(p, 2);
    await pagar(id);
    expect(await registrarEntrega(id, { id: actorId, email: "profesional@demo.co" })).toBe("entregada");
    expect((await venta(id)).fulfillment_state).toBe("entregado");

    const audit = await auditoriaDeEntrega(id);
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_id).toBe(actorId);
    expect(audit[0].entity_type).toBe("transaction");
    expect(audit[0].payload).toEqual({
      delivered_at: expect.any(String),
      treatment_id: null,
      items: [{ nutraceutical_id: p, quantity: 2 }],
    });
    // La hora del payload es la de la venta, no otra.
    const { db } = await import("@/db");
    const [fila] = await db.execute<{ iguales: boolean }>(dsql`
      select (a.payload->>'delivered_at')::timestamptz = t.delivered_at as iguales
        from clinical_audit_log a join transactions t on t.id::text = a.entity_id
       where a.event = 'nutraceutical.delivered' and a.entity_id = ${id}`);
    expect(fila.iguales).toBe(true);

    expect(await registrarEntrega(id, { id: actorId, email: null })).toBe("ya_entregada");
    expect(await auditoriaDeEntrega(id)).toHaveLength(1);
  });

  it("un pago EN REVISION no se entrega (puede ser un cobro doble); resuelto como segunda compra, si", async () => {
    const { registrarEntrega, resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const id = await enRevision();
    expect(await registrarEntrega(id, { id: actorId, email: null })).toBe("en_revision");
    await resolverRevision(id, "segunda_compra", actorId);
    expect(await registrarEntrega(id, { id: actorId, email: null })).toBe("entregada");
  });

  it("una venta SIN SALDO se entrega igual: el producto esta en la mano, lo que falla es el saldo de Atlas", async () => {
    const { registrarEntrega } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const p = await producto(1);
    const link = await checkout(p, 1);
    const cash = await efectivo(p, 1, false); // el link retiene la unica unidad
    expect((await descontarVenta(cash.id)).estado).toBe("sin_saldo");
    expect(await registrarEntrega(cash.id, { id: actorId, email: null })).toBe("entregada");
    expect((await venta(link.id)).status).toBe("pending");
  });

  // ── LA LISTA "VENTAS POR REVISAR" ──────────────────────────────────────────────────────────────
  it("la lista muestra el pago por decidir y la venta sin saldo, y deja de mostrar el pago ya resuelto", async () => {
    const { listarVentasPorRevisar } = await import("@/modules/payments/data/ventas-por-revisar");
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const porDecidir = await enRevision();
    const p = await producto(1);
    await checkout(p, 1);
    const sinSaldo = await efectivo(p, 1, false);
    await descontarVenta(sinSaldo.id);

    const lista = await listarVentasPorRevisar();
    expect(lista.find((v) => v.id === porDecidir)?.motivo).toBe("pago_sobre_link_anulado");
    expect(lista.find((v) => v.id === sinSaldo.id)?.motivo).toBe("sin_saldo");
    expect(lista.find((v) => v.id === sinSaldo.id)?.detalle).toMatch(/faltaron 1/);
    // Lo por decidir va primero: es lo unico que bloquea factura, inventario y entrega.
    const primeraNoDecision = lista.findIndex((v) => v.motivo !== "pago_sobre_link_anulado");
    const ultimaDecision = lista.map((v) => v.motivo).lastIndexOf("pago_sobre_link_anulado");
    if (primeraNoDecision >= 0) expect(ultimaDecision).toBeLessThan(primeraNoDecision);

    await resolverRevision(porDecidir, "devuelto", actorId, "WOMPI-REEMBOLSO-123");
    expect((await listarVentasPorRevisar()).some((v) => v.id === porDecidir)).toBe(false);
  });

  // ── EL SOPORTE DE LA REVISION (contabilidad, 2026-09-14; 0141) ─────────────────────────────────
  it("no se resuelve sin la version del Integrante, y 'devuelto' no se resuelve sin comprobante", async () => {
    const { resolverRevision, registrarVersionDelIntegrante, SoporteDeRevisionError } = await import(
      "@/modules/payments/data/payments-writer"
    );
    const { db } = await import("@/db");
    const id = await enRevision(false);

    await expect(resolverRevision(id, "segunda_compra", actorId)).rejects.toBeInstanceOf(SoporteDeRevisionError);
    expect((await venta(id)).review_resolution).toBeNull();

    expect(await registrarVersionDelIntegrante(id, "Queria dos unidades, una para su pareja.", actorId)).toBe(true);
    await expect(resolverRevision(id, "devuelto", actorId, "  ")).rejects.toThrow(/comprobante/);

    expect(await resolverRevision(id, "devuelto", actorId, "WOMPI-REEMBOLSO-9")).not.toBeNull();
    const [fila] = await db.execute<{ version: string; por: string; comprobante: string }>(dsql`
      select review_professional_version as version, review_professional_version_by as por,
             review_refund_reference as comprobante
        from transactions where id = ${id}`);
    expect(fila).toEqual({ version: "Queria dos unidades, una para su pareja.", por: actorId, comprobante: "WOMPI-REEMBOLSO-9" });

    // Resuelta, la version ya no se cambia: es parte del soporte.
    expect(await registrarVersionDelIntegrante(id, "otra version despues", actorId)).toBe(false);
  });

  it("la base tambien lo exige para lo que se escriba desde ahora (0141)", async () => {
    const { db } = await import("@/db");
    const id = await enRevision(false);
    await expect(
      db.execute(dsql`update transactions set review_resolution = 'segunda_compra', reviewed_at = now() where id = ${id}`),
    ).rejects.toThrow();
  });

  // ── EL EFECTIVO QUE NO SE RECIBIO (0142) ───────────────────────────────────────────────────────
  // El caso: link de Wompi pendiente, venta en efectivo que lo anula (y se entrega), y el pago de Wompi que llega
  // despues. Resulta que el efectivo no entro.
  async function cobroDobleConEfectivo(cantidadLink = 1, cantidadEfectivo = 1) {
    const { registrarEntrega, registrarVersionDelIntegrante } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const p = await producto(5);
    const link = await checkout(p, cantidadLink);
    const cash = await efectivo(p, cantidadEfectivo, true);
    await descontarVenta(cash.id);
    await registrarEntrega(cash.id, { id: actorId, email: null });
    await pagar(link.id);
    revisionesCreadas.push(link.id);
    await registrarVersionDelIntegrante(link.id, "El paciente no pago en efectivo: pago solo con tarjeta.", actorId);
    return { p, link: link.id, cash: cash.id };
  }

  async function ingresoNeto(id: string) {
    const { db } = await import("@/db");
    const [r] = await db.execute<{ comision: string; cnv: string; filas_negativas: number }>(dsql`
      select (select coalesce(sum(commission_amount), 0) from professional_revenue where transaction_id = ${id})::text as comision,
             (select coalesce(sum(amount), 0) from cnv_revenue where transaction_id = ${id})::text as cnv,
             (select count(*)::int from professional_revenue where transaction_id = ${id} and reversal_of is not null) as filas_negativas`);
    return { comision: Number(r.comision), cnv: Number(r.cnv), filasNegativas: r.filas_negativas };
  }

  it("la venta en efectivo que anula el link queda escrita en el link", async () => {
    const { db } = await import("@/db");
    const p = await producto(3);
    const link = await checkout(p, 1);
    const cash = await efectivo(p, 1, true);
    const [l] = await db.execute<{ por: string | null }>(dsql`select cancelled_by_sale_id as por from transactions where id = ${link.id}`);
    expect(l.por).toBe(cash.id);
  });

  it("EFECTIVO NO RECIBIDO: Wompi pasa a ser la venta (sin descontar otra vez), el efectivo sale con su ingreso revertido", async () => {
    const { resolverRevision, puedeMarcarseEfectivoNoRecibido } = await import("@/modules/payments/data/payments-writer");
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const { db } = await import("@/db");
    const c = await cobroDobleConEfectivo();
    expect(await puedeMarcarseEfectivoNoRecibido(c.link)).toBe("si");
    const antes = await ingresoNeto(c.cash);
    expect(antes.comision).toBeGreaterThan(0);

    const r = await resolverRevision(c.link, "efectivo_no_recibido", actorId);
    expect(r?.efectivoNoRecibido?.ventaEnEfectivoId).toBe(c.cash);
    expect(r?.efectivoNoRecibido?.casosEn90Dias).toBeGreaterThanOrEqual(1);

    const [w] = await db.execute<{ status: string; stock_state: string; cubierta: string; entrega: string | null; resolucion: string }>(dsql`
      select status, stock_state, stock_covered_by_sale_id as cubierta, fulfillment_state as entrega, review_resolution as resolucion
        from transactions where id = ${c.link}`);
    expect(w).toEqual({ status: "paid", stock_state: "en_otra_venta", cubierta: c.cash, entrega: "entregado", resolucion: "efectivo_no_recibido" });
    expect((await ingresoNeto(c.link)).comision).toBeGreaterThan(0);
    expect((await descontarVenta(c.link)).movio, "el producto se desconto dos veces").toBe(false);
    expect(await enColaDeFactura(c.link)).toBe(true);
    expect(await reclamarParaFacturar(c.link)).toBe(true);

    const [e] = await db.execute<{ marcada: boolean; entrega: string | null }>(dsql`
      select cash_not_received_at is not null as marcada, fulfillment_state as entrega from transactions where id = ${c.cash}`);
    expect(e).toEqual({ marcada: true, entrega: null });
    const despues = await ingresoNeto(c.cash);
    expect(despues.comision).toBe(0);
    expect(despues.cnv).toBe(0);
    expect(despues.filasNegativas).toBe(1);

    const [audit] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from clinical_audit_log where event = 'nutraceutical.delivery_transferred' and entity_id = ${c.link}`);
    expect(audit.n).toBe(1);
  });

  it("CONTROL: si las ventas NO coinciden, no se marca nada y se remite a contabilidad", async () => {
    const { resolverRevision, puedeMarcarseEfectivoNoRecibido } = await import("@/modules/payments/data/payments-writer");
    const c = await cobroDobleConEfectivo(1, 2);
    expect(await puedeMarcarseEfectivoNoRecibido(c.link)).toBe("no_coinciden");
    await expect(resolverRevision(c.link, "efectivo_no_recibido", actorId)).rejects.toThrow(/resuélvelo con contabilidad/);
    expect((await venta(c.link)).review_resolution).toBeNull();
    expect((await ingresoNeto(c.cash)).filasNegativas).toBe(0);
  });

  it("un link anulado a mano (sin venta en efectivo) no ofrece la salida", async () => {
    const { resolverRevision, puedeMarcarseEfectivoNoRecibido } = await import("@/modules/payments/data/payments-writer");
    const id = await enRevision();
    expect(await puedeMarcarseEfectivoNoRecibido(id)).toBe("sin_efectivo");
    await expect(resolverRevision(id, "efectivo_no_recibido", actorId)).rejects.toThrow(/no lo anuló una venta en efectivo/);
  });

  it("la escalada cuenta los casos del mismo Integrante en 90 dias", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const a = await cobroDobleConEfectivo();
    const ra = await resolverRevision(a.link, "efectivo_no_recibido", actorId);
    const b = await cobroDobleConEfectivo();
    const rb = await resolverRevision(b.link, "efectivo_no_recibido", actorId);
    expect(rb!.efectivoNoRecibido!.casosEn90Dias).toBe(ra!.efectivoNoRecibido!.casosEn90Dias + 1);
  });

  it("la nota credito manual se registra una vez, y solo sobre un efectivo marcado", async () => {
    const { resolverRevision, registrarNotaCreditoManual } = await import("@/modules/payments/data/payments-writer");
    const c = await cobroDobleConEfectivo();
    expect(await registrarNotaCreditoManual(c.cash, "NC9")).toBe(false); // todavia no esta marcada
    await resolverRevision(c.link, "efectivo_no_recibido", actorId);
    expect(await registrarNotaCreditoManual(c.cash, "NC9")).toBe(true);
    expect(await registrarNotaCreditoManual(c.cash, "NC10")).toBe(false);
  });

  it("el panel ofrece la salida solo cuando coinciden, y lista el efectivo marcado con su conteo y su nota credito", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { listarVentasPorRevisar, listarEfectivosNoRecibidos } = await import("@/modules/payments/data/ventas-por-revisar");
    const coinciden = await cobroDobleConEfectivo();
    const noCoinciden = await cobroDobleConEfectivo(1, 2);
    const aMano = await enRevision();
    const lista = await listarVentasPorRevisar();
    expect(lista.find((v) => v.id === coinciden.link)?.efectivo).toBe("si");
    expect(lista.find((v) => v.id === noCoinciden.link)?.efectivo).toBe("no_coinciden");
    expect(lista.find((v) => v.id === aMano)?.efectivo).toBe("sin_efectivo");

    await resolverRevision(coinciden.link, "efectivo_no_recibido", actorId);
    const efectivos = await listarEfectivosNoRecibidos();
    const marcado = efectivos.find((e) => e.id === coinciden.cash);
    expect(marcado?.notaCredito).toBeNull();
    expect(marcado?.casosEn90Dias).toBeGreaterThanOrEqual(1);
    expect((await listarVentasPorRevisar()).some((v) => v.id === coinciden.link)).toBe(false);
  });

  it("el efectivo no recibido no suma en el cobro reconocido", async () => {
    const { resolverRevision } = await import("@/modules/payments/data/payments-writer");
    const { createClient } = await import("@supabase/supabase-js");
    const { COLUMNA_EFECTIVO_NO_RECIBIDO, FILTRO_FUERA_DE_REVISION } = await import("@/modules/payments/cobro-reconocido");
    const c = await cobroDobleConEfectivo();
    await resolverRevision(c.link, "efectivo_no_recibido", actorId);
    const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await cliente
      .from("transactions")
      .select("id")
      .in("id", [c.link, c.cash])
      .eq("status", "paid")
      .or(FILTRO_FUERA_DE_REVISION)
      .is(COLUMNA_EFECTIVO_NO_RECIBIDO, null);
    expect(error).toBeNull();
    expect((data ?? []).map((x) => x.id)).toEqual([c.link]);
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
