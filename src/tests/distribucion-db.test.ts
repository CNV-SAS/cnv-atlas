import { eq, sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DE LA CUENTA QUINCENAL DE DISTRIBUCION (0188), contra la BD real.
//
// LAS CUATRO COSAS QUE PROTEGE:
//
//   1. UNA VENTA NO SE FACTURA DOS VECES. Es el mismo mecanismo que `settlement_id` con la comision, y el
//      mismo daño si falla: cobrarle a una persona algo que ya pago.
//   2. SIN VENTAS NO SE EMITE. El modelo lo dice textual, y una factura en cero es un documento fiscal por
//      nada.
//   3. LA SUMA EN SQL DEL SALDO PENDIENTE DA LO MISMO QUE EL MODULO PURO. Es la unica cifra de plata que no
//      pasa por el modulo (por costo: se consulta en cada despacho), asi que se cotejan sobre los mismos
//      datos. Dos aritmeticas que pueden discrepar es justo lo que el sellado de la venta evita.
//   4. UNA OBJECION QUE PROSPERA DEVUELVE LAS VENTAS AL POZO, para poder re-emitir el corte. Sin eso, darle
//      la razon al Integrante dejaria sus ventas facturadas para siempre en una cuenta retirada.
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

describe.skipIf(!HAS_DB)("la cuenta quincenal de Distribucion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let writer: any;
  let puro: any;
  let profId: string;
  let actorId: string;
  let orgId: string;
  const nutraId = "77777777-7777-7777-7777-777777777702";
  const ventas: string[] = [];
  const cuentas: string[] = [];
  const HOY = "2026-09-10"; // dentro de la primera quincena de septiembre

  /** Una venta sellada como distribucion, con su base y su descuento ya escritos. */
  async function venta(baseAmount: number, commissionAmount: number, dia = HOY): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, professional_id, status, amount, currency, payment_method,
                                wompi_env, operated_at, idempotency_key)
      values (${orgId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test', ${`${dia}T15:00:00Z`}::timestamptz,
              ${`test-distribucion-${Date.now()}-${Math.random().toString(36).slice(2)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality,
                                     vat_rate, commission_rate, supplier_share,
                                     base_amount, commission_amount, supplier_amount, cnv_amount, sealed_at)
      values (${t.id}, ${nutraId}, 1, '119000', 'distribucion',
              '0.19', '0.20', '0',
              ${String(baseAmount)}, ${String(commissionAmount)}, '0',
              ${String(baseAmount - commissionAmount)}, now())`);
    return t.id;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    writer = await import("@/modules/payments/data/distribucion-writer");
    puro = await import("@/modules/payments/distribucion");

    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    for (const id of cuentas) {
      await db.execute(dsql`delete from distribucion_statements where id = ${id}`);
    }
    ventas.length = 0;
    cuentas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  async function emitir() {
    const r = await writer.emitirCuenta({
      professionalId: profId,
      dia: HOY,
      actorId,
      actorEmail: null,
      ip: null,
    });
    cuentas.push(r.statementId);
    return r;
  }

  it("sin ventas sin facturar no se emite nada", async () => {
    await expect(emitir()).rejects.toThrow(/no hay ventas sin facturar/i);
  });

  it("la cuenta del corte sale de lo sellado en las lineas", async () => {
    await venta(100_000, 20_000);
    const c = await writer.cuentaDelCorte(profId, HOY);
    expect(c.ventas).toBe(1);
    expect(c.baseProductos).toBe(80_000);
    expect(c.iva).toBe(15_200);
    expect(c.total).toBe(95_200);
  });

  // EL CONTROL QUE MAS IMPORTA: una venta facturada no vuelve a entrar en otra cuenta.
  it("una venta facturada no entra en la cuenta siguiente", async () => {
    await venta(100_000, 20_000);
    const primera = await emitir();
    expect(primera.ventas).toBe(1);
    // El mismo corte, otra vez: ya no queda nada por facturar.
    await expect(emitir()).rejects.toThrow(/no hay ventas sin facturar/i);
  });

  it("emitir marca las ventas con su cuenta", async () => {
    const id = await venta(100_000, 20_000);
    const r = await emitir();
    const [t] = await db.execute(dsql`select distribucion_statement_id as s from transactions where id = ${id}`);
    expect(t.s).toBe(r.statementId);
  });

  // LA SUMA EN SQL CONTRA EL MODULO PURO, sobre los mismos datos. Si alguna vez discrepan, el cupo de
  // credito suspenderia (o dejaria de suspender) despachos por una cifra que la pantalla no muestra.
  it("el saldo pendiente en SQL da lo mismo que la aritmetica del modulo puro", async () => {
    await venta(100_000, 20_000);
    await venta(140_000, 28_000);
    await venta(75_630, 15_126);
    await emitir();

    const estado = await writer.estadoDeCredito(profId, HOY);
    const lineas = [
      { baseSellada: 100_000, descuentoSellado: 20_000 },
      { baseSellada: 140_000, descuentoSellado: 28_000 },
      { baseSellada: 75_630, descuentoSellado: 15_126 },
    ];
    const esperado = lineas.reduce(
      (s, l) => s + puro.precioDeFacturacionSellado(l.baseSellada, l.descuentoSellado).total,
      0,
    );
    expect(estado.saldoPendiente).toBe(esperado);
  });

  it("una cuenta pagada deja de pesar en el saldo", async () => {
    await venta(100_000, 20_000);
    const r = await emitir();
    await writer.registrarPagoDeCuenta({
      statementId: r.statementId,
      monto: 95_200,
      nota: null,
      actorId,
      actorEmail: null,
    });
    const estado = await writer.estadoDeCredito(profId, HOY);
    expect(estado.saldoPendiente).toBe(0);
  });

  it("no se paga dos veces la misma cuenta", async () => {
    await venta(100_000, 20_000);
    const r = await emitir();
    const pago = { statementId: r.statementId, monto: 95_200, nota: null, actorId, actorEmail: null };
    await writer.registrarPagoDeCuenta(pago);
    await expect(writer.registrarPagoDeCuenta(pago)).rejects.toThrow(/ya estaba pagada/i);
  });

  // UNA OBJECION QUE PROSPERA DEVUELVE LAS VENTAS AL POZO. Sin esto, darle la razon al Integrante dejaria
  // sus ventas facturadas para siempre dentro de una cuenta retirada, y el corte no se podria rehacer.
  it("objetar y corregir devuelve las ventas a lo no facturado", async () => {
    await venta(100_000, 20_000);
    const r = await emitir();
    await writer.objetarCuenta({
      statementId: r.statementId,
      professionalId: profId,
      motivo: "Esa venta no es mia, fue en efectivo del consultorio de al lado",
      actorId,
      actorEmail: null,
    });
    await writer.resolverObjecion({
      statementId: r.statementId,
      desenlace: "corregida",
      actorId,
      actorEmail: null,
    });
    const c = await writer.cuentaDelCorte(profId, HOY);
    expect(c.ventas).toBe(1); // vuelve a estar por facturar
  });

  it("sostener la objecion deja la cuenta como estaba", async () => {
    await venta(100_000, 20_000);
    const r = await emitir();
    await writer.objetarCuenta({
      statementId: r.statementId,
      professionalId: profId,
      motivo: "No estoy de acuerdo con el precio que salio en la cuenta",
      actorId,
      actorEmail: null,
    });
    await writer.resolverObjecion({
      statementId: r.statementId,
      desenlace: "sostenida",
      actorId,
      actorEmail: null,
    });
    const c = await writer.cuentaDelCorte(profId, HOY);
    expect(c.ventas).toBe(0); // sigue facturada
  });

  it("una cuenta emitida no se edita", async () => {
    await venta(100_000, 20_000);
    const r = await emitir();
    let mensaje = "";
    try {
      await db
        .update(schema.distribucionStatements)
        .set({ corteHasta: "2026-10-31" })
        .where(eq(schema.distribucionStatements.id, r.statementId));
    } catch (e) {
      const err = e as { message?: string; cause?: { message?: string } };
      mensaje = `${err.cause?.message ?? ""} ${err.message ?? ""}`;
    }
    expect(mensaje).toMatch(/no se edita/i);
  });
});
