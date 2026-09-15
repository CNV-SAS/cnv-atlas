import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ EL SELLADO REPARTE CON EL PROVEEDOR, NO SOLO CON EL INTEGRANTE ═══
//
// EL DEFECTO (2026-09-13, un dia antes de produccion). El sellado registraba como ingreso de CNV "base menos
// comision". En LUVIA, donde el proveedor se lleva el 70% de la base, una venta de 90.000 dejaba 60.504 de
// ingreso de CNV cuando el real es 7.563. `revenue_splits` existia con vigencia y nadie lo leia, y
// `repartir` existia puro y probado y nadie lo llamaba.
//
// SE MIDE CONTRA BASE REAL porque lo que se protege es el CABLE: que el sellado lea la vigencia correcta de
// la tabla y la pase al reparto. El reparto en si ya tiene sus tests unitarios (reparto.test.ts).
//
// Y ES UN TEST QUE PUEDE FALLAR: con el sellado anterior, el primer caso da 60.504 y no 7.563 (verificado
// corriendolo contra el writer viejo antes de dejarlo).

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const ventas: string[] = [];
const productos: string[] = [];
let organizationId = "";
let patientId = "";
let profesional20 = "";
let luvia = "";
let multicell = "";

async function sellarEnEfectivo(lineas: { id: string; cantidad: number; precio: number }[], profesional: string | null) {
  const { createPaidCashTransaction } = await import("@/modules/payments/data/payments-writer");
  const amount = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const { id } = await createPaidCashTransaction({
    organizationId,
    patientId,
    professionalId: profesional,
    amount,
    currency: "COP",
    idempotencyKey: `test-reparto-${randomUUID()}`,
    items: lineas.map((l) => ({ nutraceuticalId: l.id, quantity: l.cantidad, unitPrice: l.precio })),
  });
  ventas.push(id);
  return id;
}

async function leer(txId: string) {
  const { db } = await import("@/db");
  const [c] = await db.execute<{ amount: string }>(dsql`select amount from cnv_revenue where transaction_id = ${txId}`);
  const [p] = await db.execute<{ commission_amount: string }>(
    dsql`select commission_amount from professional_revenue where transaction_id = ${txId}`,
  );
  return { cnv: Number(c?.amount), comision: p ? Number(p.commission_amount) : null };
}

async function productoDePrueba(nombre: string): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership)
    values (${id}, ${organizationId}, ${nombre}, 107100, true, 'propio')`);
  productos.push(id);
  return id;
}

describe.skipIf(!HAS_DB)("el reparto del sellado (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    organizationId = org.id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [prof] = await db.execute<{ id: string }>(
      dsql`select id from professional_profiles where commission_rate = 0.20 limit 1`,
    );
    profesional20 = prof.id;
    const [l] = await db.execute<{ id: string }>(dsql`
      select n.id from nutraceuticals n
        join revenue_splits rs on rs.nutraceutical_id = n.id and rs.valid_to is null and rs.supplier_share = 0.70
       where n.name = 'LUVIA'`);
    luvia = l.id;
    const [m] = await db.execute<{ id: string }>(dsql`
      select n.id from nutraceuticals n
       where n.ownership = 'propio' and not n.is_test
         and not exists (select 1 from revenue_splits rs where rs.nutraceutical_id = n.id)
       limit 1`);
    multicell = m.id;
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of ventas) await db.execute(dsql`delete from transactions where id = ${id}`);
    for (const id of productos) await db.execute(dsql`delete from nutraceuticals where id = ${id}`);
  });

  it("UNA LUVIA de 90.000 con un Integrante al 20%: comisión 15.126 y CNV 7.563, no 60.504", async () => {
    const v = await sellarEnEfectivo([{ id: luvia, cantidad: 1, precio: 90000 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 15126, cnv: 7563 });
  });

  it("un producto propio sigue igual: base 90.000, comisión 18.000, CNV 72.000", async () => {
    const v = await sellarEnEfectivo([{ id: multicell, cantidad: 1, precio: 107100 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 18000, cnv: 72000 });
  });

  it("DOS LUVIA: la base es la de la factura (151.260), no la del total (151.261)", async () => {
    const v = await sellarEnEfectivo([{ id: luvia, cantidad: 2, precio: 90000 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 30252, cnv: 15126 });
  });

  it("una venta MIXTA reparte cada línea con lo suyo", async () => {
    const v = await sellarEnEfectivo(
      [
        { id: luvia, cantidad: 1, precio: 90000 },
        { id: multicell, cantidad: 1, precio: 107100 },
      ],
      profesional20,
    );
    expect(await leer(v)).toEqual({ comision: 15126 + 18000, cnv: 7563 + 72000 });
  });

  it("sin profesional no hay comisión, y CNV se queda con lo que no es del proveedor", async () => {
    const v = await sellarEnEfectivo([{ id: luvia, cantidad: 1, precio: 90000 }], null);
    expect(await leer(v)).toEqual({ comision: null, cnv: 22689 });
  });

  // LAS DOS DE ABAJO SON NEGATIVAS ("no aplica") y pasarian igual con un sellado que no leyera la tabla.
  // Esta es su pareja: la MISMA forma de fila, vigente desde hoy, SI aplica. Juntas fijan el borde: un filtro
  // demasiado laxo rompe las negativas, uno demasiado estricto rompe esta.
  it("CONTROL: una vigencia que empieza HOY sí aplica", async () => {
    const { db } = await import("@/db");
    const p = await productoDePrueba(`TEST REPARTO HOY ${randomUUID().slice(0, 8)}`);
    await db.execute(dsql`
      insert into revenue_splits (nutraceutical_id, supplier_share, valid_from)
      values (${p}, 0.70, (now() at time zone 'America/Bogota')::date)`);
    const v = await sellarEnEfectivo([{ id: p, cantidad: 1, precio: 107100 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 18000, cnv: 9000 });
  });

  it("una vigencia CERRADA hoy ya no aplica (valid_to es exclusivo)", async () => {
    const { db } = await import("@/db");
    const p = await productoDePrueba(`TEST REPARTO CERRADO ${randomUUID().slice(0, 8)}`);
    await db.execute(dsql`
      insert into revenue_splits (nutraceutical_id, supplier_share, valid_from, valid_to)
      values (${p}, 0.70, date '2026-01-01', (now() at time zone 'America/Bogota')::date)`);
    const v = await sellarEnEfectivo([{ id: p, cantidad: 1, precio: 107100 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 18000, cnv: 72000 });
  });

  it("una vigencia que EMPIEZA mañana todavía no aplica", async () => {
    const { db } = await import("@/db");
    const p = await productoDePrueba(`TEST REPARTO FUTURO ${randomUUID().slice(0, 8)}`);
    await db.execute(dsql`
      insert into revenue_splits (nutraceutical_id, supplier_share, valid_from)
      values (${p}, 0.70, (now() at time zone 'America/Bogota')::date + 1)`);
    const v = await sellarEnEfectivo([{ id: p, cantidad: 1, precio: 107100 }], profesional20);
    expect(await leer(v)).toEqual({ comision: 18000, cnv: 72000 });
  });

  // ── EL REPARTO SELLADO EN LA LINEA (0143, paso 5 del 3.4) ─────────────────────────────────────────
  async function lineas(txId: string) {
    const { db } = await import("@/db");
    return db.execute<{
      nutraceutical_id: string;
      vat_rate: string;
      commission_rate: string;
      supplier_share: string;
      modality: string;
      base_amount: string;
      commission_amount: string;
      supplier_amount: string;
      cnv_amount: string;
      sellada: boolean;
    }>(dsql`
      select nutraceutical_id, vat_rate::text, commission_rate::text, supplier_share::text, modality,
             base_amount::text, commission_amount::text, supplier_amount::text, cnv_amount::text,
             sealed_at is not null as sellada
        from transaction_items where transaction_id = ${txId} order by base_amount`);
  }

  it("cada linea sella sus tasas y sus montos, y las lineas suman lo que va a comision e ingreso", async () => {
    const v = await sellarEnEfectivo(
      [
        { id: luvia, cantidad: 1, precio: 90000 },
        { id: multicell, cantidad: 1, precio: 107100 },
      ],
      profesional20,
    );
    const [l, m] = await lineas(v);
    expect(l).toMatchObject({ nutraceutical_id: luvia, modality: "comision", sellada: true });
    expect(Number(l.vat_rate)).toBe(0.19);
    expect(Number(l.supplier_share)).toBe(0.7);
    expect(Number(l.base_amount)).toBe(75630);
    expect(Number(l.commission_amount)).toBe(15126);
    // LA PARTE DEL PROVEEDOR, que antes no quedaba en ningun lado: 70% de 75.630.
    expect(Number(l.supplier_amount)).toBe(52941);
    expect(Number(l.cnv_amount)).toBe(7563);
    expect(Number(m.supplier_share)).toBe(0);
    expect(Number(m.supplier_amount)).toBe(0);

    const { comision, cnv } = await leer(v);
    expect(Number(l.commission_amount) + Number(m.commission_amount)).toBe(comision);
    expect(Number(l.cnv_amount) + Number(m.cnv_amount)).toBe(cnv);
  });

  it("la tasa del Integrante sale de su VIGENCIA, no de la tasa viva del perfil", async () => {
    const { db } = await import("@/db");
    const [vigente] = await db.execute<{ id: string; rate: string }>(dsql`
      select id, rate::text from professional_commission_rates where professional_id = ${profesional20} and valid_to is null`);
    let creada: string | null = null;
    if (!vigente) {
      const [n] = await db.execute<{ id: string }>(dsql`
        insert into professional_commission_rates (professional_id, rate, valid_from)
        values (${profesional20}, 0.20, date '2026-01-01') returning id`);
      creada = n.id;
    }
    const tasaVigente = vigente ? Number(vigente.rate) : 0.2;
    // El perfil dice otra cosa: si el sellado leyera la tasa viva, la linea saldria al 25%.
    await db.execute(dsql`update professional_profiles set commission_rate = 0.25 where id = ${profesional20}`);
    try {
      const v = await sellarEnEfectivo([{ id: multicell, cantidad: 1, precio: 107100 }], profesional20);
      const [linea] = await lineas(v);
      expect(Number(linea.commission_rate)).toBe(tasaVigente);
      expect((await leer(v)).comision).toBe(Math.round(90000 * tasaVigente * 100) / 100);
    } finally {
      await db.execute(dsql`update professional_profiles set commission_rate = 0.20 where id = ${profesional20}`);
      if (creada) await db.execute(dsql`delete from professional_commission_rates where id = ${creada}`);
    }
  });

  it("la base no admite una linea a medio sellar", async () => {
    const { db } = await import("@/db");
    const v = await sellarEnEfectivo([{ id: multicell, cantidad: 1, precio: 107100 }], profesional20);
    await expect(
      db.execute(dsql`update transaction_items set supplier_amount = null where transaction_id = ${v}`),
    ).rejects.toThrow();
  });
});
