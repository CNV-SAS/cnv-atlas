import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DEL DOMICILIO CONTRA LA BD REAL (0190).
//
// LAS CUATRO COSAS QUE PROTEGE, y las cuatro viven en la base, no en el codigo:
//
//   1. UN DOMICILIO SIN DIRECCION NO SE PUEDE GUARDAR. Una venta que hay que despachar y no dice a donde es
//      una venta que nadie puede cumplir.
//   2. UN FLETE EN UNA VENTA EN CONSULTA TAMPOCO. Es un cobro sin causa, y es el error en la otra direccion.
//   3. EL RETRACTO SE REGISTRA CON SU EVIDENCIA, y no se puede registrar a medias (la fecha sin el sello).
//   4. Y CUANDO PROCEDE, EL FLETE SE REVIERTE. Es la parte que ningun otro camino toca: la devolucion fisica
//      revierte el dinero LINEA POR LINEA, y el flete no es una linea. Sin esto, el articulo 47 quedaria a
//      medias: se devolveria el producto y no "todas las sumas pagadas".
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

describe.skipIf(!HAS_DB)("el domicilio y el retracto (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: any;
  let profId: string;
  let actorId: string;
  let orgId: string;
  let patientId: string;
  const ventas: string[] = [];

  async function venta(o: {
    domicilio?: boolean;
    flete?: number | null;
    costo?: number | null;
    entregadaHace?: number;
  } = {}): Promise<string> {
    const entregada =
      o.entregadaHace == null ? null : new Date(Date.now() - o.entregadaHace * 86_400_000).toISOString();
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, operated_at,
                                delivery_mode, shipping_address, shipping_city, shipping_fee, shipping_cost,
                                fulfillment_state, delivered_at)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
              ${`test-domicilio-${Date.now()}-${Math.random().toString(36).slice(2)}`}, now(),
              ${o.domicilio ? "domicilio" : "en_consulta"},
              ${o.domicilio ? "Calle 1 # 2-3" : null},
              ${o.domicilio ? "Medellín" : null},
              ${o.flete == null ? null : String(o.flete)},
              ${o.costo == null ? null : String(o.costo)},
              ${entregada ? "entregado" : "pendiente"},
              ${entregada}::timestamptz)
      returning id`);
    ventas.push(t.id);
    return t.id;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/payments/data/retracto-writer");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
    const [pac] = await db.execute(dsql`select id from patients limit 1`);
    patientId = pac.id;
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from cnv_revenue where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    ventas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("un domicilio sin direccion no se puede guardar", async () => {
    await expect(
      db.execute(dsql`
        insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                  payment_method, wompi_env, idempotency_key, delivery_mode)
        values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
                ${`test-sin-dir-${Date.now()}`}, 'domicilio')`),
    ).rejects.toThrow();
  });

  it("un flete en una venta en consulta tampoco: seria un cobro sin causa", async () => {
    await expect(venta({ domicilio: false, flete: 12_000 })).rejects.toThrow();
    ventas.pop();
  });

  it("una venta a domicilio entregada tiene su plazo de retracto", async () => {
    const id = await venta({ domicilio: true, flete: 11_900, entregadaHace: 1 });
    const e = await writer.estadoDeRetracto(id);
    expect(e.aplica).toBe(true);
    expect(e.limite).not.toBeNull();
    expect(e.vencido).toBe(false);
    // El reintegro es TODO lo pagado, con el envio dentro.
    expect(e.reintegro).toBe(119_000);
    expect(e.flete).toBe(11_900);
  });

  it("una venta en consulta no lo tiene", async () => {
    const id = await venta({ domicilio: false });
    const e = await writer.estadoDeRetracto(id);
    expect(e.aplica).toBe(false);
  });

  it("registrarlo con el sello intacto lo acepta y revierte el flete", async () => {
    const id = await venta({ domicilio: true, flete: 11_900, entregadaHace: 1 });
    // El ingreso original, para poder medir la reversion por diferencia.
    await db.execute(dsql`insert into cnv_revenue (transaction_id, amount) values (${id}, '100000')`);
    const r = await writer.registrarRetracto({
      transactionId: id,
      selloIntacto: true,
      nota: null,
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(r.procede).toBe(true);
    expect(r.reintegro).toBe(119_000);
    const [suma] = await db.execute(dsql`
      select coalesce(sum(amount), 0)::numeric as total from cnv_revenue where transaction_id = ${id}`);
    // 100.000 menos la BASE del flete (11.900 traen 10.000 de base y 1.900 de IVA; el IVA no es ingreso).
    expect(Number(suma.total)).toBe(90_000);
  });

  it("con el sello roto NO procede, y el flete NO se revierte", async () => {
    const id = await venta({ domicilio: true, flete: 11_900, entregadaHace: 1 });
    await db.execute(dsql`insert into cnv_revenue (transaction_id, amount) values (${id}, '100000')`);
    const r = await writer.registrarRetracto({
      transactionId: id,
      selloIntacto: false,
      nota: "Llegó abierto",
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(r.procede).toBe(false);
    const [suma] = await db.execute(dsql`
      select coalesce(sum(amount), 0)::numeric as total from cnv_revenue where transaction_id = ${id}`);
    expect(Number(suma.total)).toBe(100_000);
  });

  // UN RETRACTO NEGADO TAMBIEN QUEDA REGISTRADO: es una decision con consecuencias, y su razon tiene que
  // constar. Por eso no se puede volver a registrar: la primera decision es la que se tomo.
  it("no se registra dos veces", async () => {
    const id = await venta({ domicilio: true, flete: 11_900, entregadaHace: 1 });
    const args = { transactionId: id, selloIntacto: true, nota: null, actorId, actorEmail: null, ip: null };
    await writer.registrarRetracto(args);
    await expect(writer.registrarRetracto(args)).rejects.toThrow(/ya se registró/i);
  });

  it("fuera del plazo no procede aunque vuelva sellado", async () => {
    const id = await venta({ domicilio: true, flete: 11_900, entregadaHace: 30 });
    const r = await writer.registrarRetracto({
      transactionId: id,
      selloIntacto: true,
      nota: null,
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(r.procede).toBe(false);
    expect(r.motivo).toMatch(/venció/i);
  });

  it("el lector en lote solo devuelve las de domicilio", async () => {
    const conEnvio = await venta({ domicilio: true, flete: 11_900, entregadaHace: 1 });
    const enConsulta = await venta({ domicilio: false });
    const mapa = await writer.retractosDeLasVentas([conEnvio, enConsulta]);
    expect(mapa.has(conEnvio)).toBe(true);
    expect(mapa.has(enConsulta)).toBe(false);
  });
  // ═══ EL COSTO DEL DOMICILIARIO Y SU CONSOLIDADO (0192) ═══

  // LO COBRADO NUNCA PUEDE SER MENOR QUE EL COSTO: si lo fuera, CNV estaria pagando por despachar, que es
  // justo el caso que el margen existe para impedir.
  it("no se puede cobrar un flete menor que lo que cuesta el envio", async () => {
    await expect(venta({ domicilio: true, flete: 9_000, costo: 10_000 })).rejects.toThrow();
    ventas.pop();
  });

  it("un costo en una venta en consulta tampoco se guarda", async () => {
    await expect(venta({ domicilio: false, costo: 10_000 })).rejects.toThrow();
    ventas.pop();
  });

  it("el consolidado suma lo que hay que pagarle al domiciliario", async () => {
    const reader = await import("@/modules/payments/data/despachos-reader");
    const hoy = new Date().toISOString().slice(0, 10);
    const antes = await reader.consolidadoDeDespachos(hoy);
    await venta({ domicilio: true, flete: 12_257, costo: 10_000 });
    await venta({ domicilio: true, flete: 14_000, costo: 11_000 });
    const despues = await reader.consolidadoDeDespachos(hoy);
    expect(despues.totalCosto - antes.totalCosto).toBe(21_000);
    expect(despues.totalFlete - antes.totalFlete).toBe(26_257);
    // LA DIFERENCIA NO ES MARGEN: es lo que se lleva la pasarela por cobrar el flete.
    expect(despues.diferencia - antes.diferencia).toBe(5_257);
  });
});