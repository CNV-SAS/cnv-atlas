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
    entregadaHace?: number;
  } = {}): Promise<string> {
    const entregada =
      o.entregadaHace == null ? null : new Date(Date.now() - o.entregadaHace * 86_400_000).toISOString();
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, operated_at,
                                delivery_mode, shipping_address, shipping_city,
                                fulfillment_state, delivered_at)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
              ${`test-domicilio-${Date.now()}-${Math.random().toString(36).slice(2)}`}, now(),
              ${o.domicilio ? "domicilio" : "en_consulta"},
              ${o.domicilio ? "Calle 1 # 2-3" : null},
              ${o.domicilio ? "Medellín" : null},
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

  // ═══ ESTE CASO SE INVIERTE, Y NO ES QUE ESTUVIERA MAL: LA REGLA CAMBIO (legal, 2026-10-08) ═══
  //
  // DECIA "un domicilio sin direccion no se puede guardar", que era el invariante de la 0190 y era correcto
  // entonces: la direccion la tecleaba el profesional al cobrar, asi que una venta a domicilio nacia con ella.
  //
  // LEGAL LO CAMBIO, con su razon: *"la direccion la captura quien coordina el envio, no el profesional en
  // consulta"*, porque CNV ya tiene que llamar al paciente para confirmarle el valor del envio. Con eso, exigir
  // la direccion al nacer es imposible de cumplir.
  //
  // EL INVARIANTE NO DESAPARECIO, SE MUDO al momento en que es verdad: no se puede ENTREGAR sin direccion
  // (0213). Asi que el caso no se borra, se invierte: se comprueba que NACER sin direccion ya se permite, y el
  // porton de la entrega vive en su propio candado (`el-envio-no-se-entrega-sin-direccion-db`).
  //
  // SE DEJA ESCRITO POR QUE, porque un caso invertido sin explicacion se lee como un candado que alguien aflojo
  // para que dejara de molestar.
  it("un domicilio SI puede nacer sin direccion: la pide quien coordina", async () => {
    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, delivery_mode, fulfillment_state)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
              ${`test-sin-dir-${Date.now()}`}, 'domicilio', 'pendiente')
      returning id`);
    ventas.push(t.id);
    const [v] = await db.execute<{ shipping_address: string | null }>(dsql`
      select shipping_address from transactions where id = ${t.id}`);
    expect(v.shipping_address).toBeNull();
  });

  it("una venta a domicilio entregada tiene su plazo de retracto", async () => {
    const id = await venta({ domicilio: true, entregadaHace: 1 });
    const e = await writer.estadoDeRetracto(id);
    expect(e.aplica).toBe(true);
    expect(e.limite).not.toBeNull();
    expect(e.vencido).toBe(false);
    // EL REINTEGRO ES EL MONTO DE LA VENTA, sin partes: el envio se lo pago al mensajero y CNV no lo devuelve
    // (asesor legal, 2026-10-06).
    expect(e.reintegro).toBe(119_000);
  });

  it("una venta en consulta no lo tiene", async () => {
    const id = await venta({ domicilio: false });
    const e = await writer.estadoDeRetracto(id);
    expect(e.aplica).toBe(false);
  });

  it("registrarlo con el sello intacto lo acepta, y el ingreso de CNV no se toca aqui", async () => {
    const id = await venta({ domicilio: true, entregadaHace: 1 });
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
    // EL INGRESO QUEDA INTACTO, y eso es lo que cambio el 2026-10-06. Antes se le restaba la base del flete,
    // porque CNV lo habia cobrado; ya no lo cobra, asi que no hay nada que revertir aqui. El PRODUCTO si se
    // revierte, por el camino de la devolucion fisica, que devuelve su parte del reparto linea por linea.
    expect(Number(suma.total)).toBe(100_000);
  });

  it("con el sello roto NO procede, y el ingreso tampoco se toca", async () => {
    const id = await venta({ domicilio: true, entregadaHace: 1 });
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
    const id = await venta({ domicilio: true, entregadaHace: 1 });
    const args = { transactionId: id, selloIntacto: true, nota: null, actorId, actorEmail: null, ip: null };
    await writer.registrarRetracto(args);
    await expect(writer.registrarRetracto(args)).rejects.toThrow(/ya se registró/i);
  });

  it("fuera del plazo no procede aunque vuelva sellado", async () => {
    const id = await venta({ domicilio: true, entregadaHace: 30 });
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
    const conEnvio = await venta({ domicilio: true, entregadaHace: 1 });
    const enConsulta = await venta({ domicilio: false });
    const mapa = await writer.retractosDeLasVentas([conEnvio, enConsulta]);
    expect(mapa.has(conEnvio)).toBe(true);
    expect(mapa.has(enConsulta)).toBe(false);
  });
  // ── AQUI VIVIAN LOS DOS CHECK DEL FLETE (0192), Y SE FUERON CON LAS COLUMNAS (0207) ───────────────
  //
  // Probaban que un flete no pudiera ser menor que lo que cuesta el envio (CNV pagando por despachar) y que
  // no pudiera haber un costo en una venta en consulta (un cobro sin causa).
  //
  // EL 2026-10-05 LOS DEJE PROBADOS con el argumento de que seguian siendo la ultima defensa de los datos
  // historicos. La consulta a la nube del 2026-10-06 dio CERO ventas con flete, asi que las columnas se
  // borraron y los CHECK se fueron con ellas: no hay dato que defender ni cifra que pueda quedar incoherente.
  //
  // EL CHECK QUE SI SE QUEDA es `transactions_domicilio_completo`, y esta probado arriba: un domicilio sigue
  // necesitando direccion y ciudad, porque sin ellas no se puede despachar.

  // ═══ LA COLA DE ENVIOS POR COORDINAR (2026-10-05) ═══
  //
  // REEMPLAZA AL CANDADO DEL CONSOLIDADO, que sumaba lo que habia que pagarle al domiciliario. Esa cuenta no
  // existe: CNV no paga el envio. Lo que hay que guardar ahora es que el envio NO SE PIERDA, porque alguien
  // tiene que llamar al paciente y despacharlo a mano.
  it("un envio pagado y sin entregar aparece en la cola", async () => {
    const reader = await import("@/modules/payments/data/despachos-reader");
    const antes = (await reader.enviosPorCoordinar()).length;
    const id = await venta({ domicilio: true });
    const cola = await reader.enviosPorCoordinar();
    expect(cola.length).toBe(antes + 1);
    expect(cola.some((e) => e.transactionId === id)).toBe(true);
  });

  // LO QUE EL CANDADO DE VERDAD PERSIGUE: que entregarlo lo SAQUE de la cola. Un envio que se queda ahi
  // despues de despachado hace que la lista deje de servir, y entonces nadie la mira.
  it("y entregarlo lo saca de la cola y lo pasa a los despachados", async () => {
    const reader = await import("@/modules/payments/data/despachos-reader");
    const id = await venta({ domicilio: true, entregadaHace: 1 });
    const cola = await reader.enviosPorCoordinar();
    expect(cola.some((e) => e.transactionId === id)).toBe(false);
    const hechos = await reader.enviosDespachados();
    expect(hechos.some((e) => e.transactionId === id)).toBe(true);
  });

  // UNA VENTA EN CONSULTA NO ES UN ENVIO. Si entrara, la cola mandaria a despachar producto que el paciente
  // ya se llevo en la mano.
  it("una venta en consulta no entra en la cola de envios", async () => {
    const reader = await import("@/modules/payments/data/despachos-reader");
    const id = await venta({ domicilio: false });
    const cola = await reader.enviosPorCoordinar();
    expect(cola.some((e) => e.transactionId === id)).toBe(false);
  });
});