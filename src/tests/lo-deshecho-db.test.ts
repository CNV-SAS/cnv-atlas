import { sql as dsql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE "LO QUE SE DESHIZO", CONTRA LA BD REAL ═══
//
// LO QUE PROTEGE, y por que tiene que ser contra la base: son agregaciones con `filter` y `join`, la clase
// de SQL que compila, corre y devuelve un numero PLAUSIBLE Y EQUIVOCADO. Aqui un conteo de mas no rompe
// nada: produce una conclusion de negocio falsa ("se nos devuelve el 8%"), que es peor que un error.
//
// Y EL CASO QUE VALE MAS QUE TODOS LOS DEMAS: que un LINK ANULADO no cuente como venta deshecha. Nadie
// compro y nadie devolvio nada, asi que meterlo arriba inflaria la tasa de reversion con algo que nunca se
// hizo. Es el mismo error que ya cometimos al reves con la venta suelta en los insights: dos hechos
// distintos contados como uno solo.
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

describe.skipIf(!HAS_DB)("lo que se deshizo (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let lector: any;
  let orgId: string;
  let profId: string;
  let profileId: string;
  let patientId: string;
  // LA UBICACION Y EL SALDO SE PREPARAN, NO SE SUPONEN. El caso del motivo pasaba en verde por su rama de
  // escape sin comprobar nada: la venta no llevaba ubicacion, asi que no habia salida de inventario y no
  // habia nada que devolver. Se descubrio quitando la rama, que es la unica forma de saber si un test que
  // pasa esta probando algo.
  let locationId = "";
  const nutra = "77777777-7777-7777-7777-777777777702"; // MULTICELL, dedicado a pruebas
  const ventas: string[] = [];
  const reversas: string[] = [];

  /** Una venta pagada de hoy, con una linea. Devuelve la venta y su linea. */
  async function ventaPagada(cantidad = 2): Promise<{ id: string; lineaId: string }> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, operated_at, location_id,
                                stock_state)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '100000', 'COP', 'efectivo', 'test',
              ${`test-deshecho-${Date.now()}-${Math.random().toString(36).slice(2)}`}, now(),
              ${locationId}, 'pendiente')
      returning id`);
    ventas.push(t.id);
    const [li] = await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${t.id}, ${nutra}, ${cantidad}, '50000') returning id`);
    // EL REPARTO SE SELLA POR EL CAMINO REAL. Sin el, una devolucion no puede revertir su parte
    // proporcional y para en voz alta (0143), asi que un fixture que lo salte no puede probar la devolucion.
    // Y se usa la funcion de la app, no un UPDATE a mano: sellar a mano seria un segundo constructor del
    // mismo dato, y el test dejaria de comprobar lo que la app escribe.
    const { sellarContabilidadDeLaVenta } = await import("@/modules/payments/data/payments-writer");
    await db.transaction(async (tx: any) => {
      await sellarContabilidadDeLaVenta(tx, { id: t.id, amount: "100000", professionalId: profId });
    });
    return { id: t.id, lineaId: li.id };
  }

  /** Un link que no llego a cobrarse. `reemplazadoPor` lo marca como cubierto por otra venta. */
  async function linkAnulado(o: { reemplazadoPor?: string | null } = {}): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, cancelled_at, cancelled_by,
                                cancelled_by_sale_id)
      values (${orgId}, ${patientId}, ${profId}, 'failed', '100000', 'COP', 'wompi', 'test',
              ${`test-deshecho-link-${Date.now()}-${Math.random().toString(36).slice(2)}`}, now(),
              ${profileId}, ${o.reemplazadoPor ?? null})
      returning id`);
    ventas.push(t.id);
    return t.id;
  }

  /** Una devolucion del paciente, con su linea y sus unidades (lo exige la 0175). */
  async function devolucion(o: { venta: string; linea: string; unidades: number; monto: number; nota: string }) {
    const [r] = await db.execute(dsql`
      insert into sale_reversals (transaction_id, kind, state, product_ownership, transaction_item_id,
                                  returned_quantity, debited_amount, note, resolved_at, resolved_by)
      values (${o.venta}, 'devolucion', 'devuelta', 'propio', ${o.linea}, ${o.unidades},
              ${String(o.monto)}, ${o.nota}, now(), ${profileId})
      returning id`);
    reversas.push(r.id);
    return r.id;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    lector = await import("@/modules/direccion/data/lo-deshecho");

    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    profileId = prof.profile_id;
    orgId = prof.organization_id;

    const [pac] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`DESH-${Date.now()}`}) returning id`);
    patientId = pac.id;

    // ── LA VITRINA DEL PROFESIONAL, CON SALDO DEL PRODUCTO DE PRUEBA ──
    //
    // Los movimientos son APPEND-ONLY por trigger (registro de custodia), asi que no se pueden limpiar: el
    // lote se REUSA entre corridas y se le repone saldo cada vez, que es lo que hace el fixture estable.
    const [loc] = await db.execute(dsql`
      select id from inventory_locations
       where professional_id = ${profId} and is_active and sellable limit 1`);
    locationId = loc?.id ?? "";
    const [lote] = await db.execute(dsql`
      select id from lots where nutraceutical_id = ${nutra} order by created_at limit 1`);
    if (locationId && lote) {
      await db.execute(dsql`
        insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, location_id, lot_id,
                                                   delta, type, reason)
        values (${profId}, ${nutra}, ${locationId}, ${lote.id}, 20, 'recepcion',
                'Fixture de lo-deshecho: saldo para poder vender y devolver')`);
    }
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of reversas) await db.execute(dsql`delete from sale_reversals where id = ${id}`);
    for (const id of ventas) {
      // LAS FILAS DE INGRESO SE BORRAN A MANO: con `session_replication_role = replica` los triggers estan
      // apagados, y eso incluye los de las llaves foraneas, asi que el borrado en cascada NO corre. Sin esto
      // quedarian filas de comision e ingreso apuntando a una venta que ya no existe.
      await db.execute(dsql`delete from professional_revenue where transaction_id = ${id}`);
      await db.execute(dsql`delete from cnv_revenue where transaction_id = ${id}`);
      await db.execute(dsql`delete from sale_reversals where transaction_id = ${id}`);
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    reversas.length = 0;
    ventas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from patients where id = ${patientId}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("una devolución cuenta en su clase, con su dinero y su motivo", async () => {
    const antes = await lector.loDeshecho();
    const v = await ventaPagada(3);
    await devolucion({ venta: v.id, linea: v.lineaId, unidades: 2, monto: 100000, nota: "no le cayó bien" });
    const despues = await lector.loDeshecho();

    const fila = (r: any) =>
      r.porClase.find((c: any) => c.clase === "devolucion" && c.estado === "devuelta");
    expect((fila(despues)?.veces ?? 0) - (fila(antes)?.veces ?? 0)).toBe(1);
    expect((fila(despues)?.monto ?? 0) - (fila(antes)?.monto ?? 0)).toBe(100000);
    expect(despues.motivos.some((m: any) => m.motivo === "no le cayó bien")).toBe(true);
    // LAS UNIDADES, no las veces: devolver dos de un producto y una de otro no es lo mismo que dos
    // devoluciones de uno solo, y la pregunta de la direccion cientifica es que vuelve, no cuantas veces.
    const prod = despues.productosDevueltos.find((p: any) => p.unidades > 0);
    expect(prod, "ninguna devolución llegó a la tabla de productos").toBeTruthy();
  });

  // ═══ EL MOTIVO QUE ESCRIBE LA PERSONA LLEGA A LA PANTALLA (Santiago, 2026-09-30) ═══
  //
  // LO QUE PASO: el bloque "Por qué" mostraba "Devolución de 1 de 2 unidades de la línea", una frase del
  // codigo, y yo concluí que el formulario no pedia motivo. SI LO PIDE. Se guardaba en el movimiento de
  // inventario y la reversa se quedaba con la frase, asi que el texto de Santiago no aparecia en ninguna
  // pantalla. Es la misma forma que la nota credito: el dato esta y la pantalla dice otra cosa.
  //
  // Se prueba CONTRA EL CAMINO REAL (el writer de la devolucion fisica), no insertando la reversa a mano:
  // insertandola a mano se probaria que el agregado lee la columna, que es justo lo que no fallaba. Lo que
  // fallaba era que nadie escribiera el motivo EN esa columna.
  it("el motivo escrito al devolver es el que sale en la pantalla", async () => {
    const { registrarDevolucionFisica } = await import("@/modules/payments/data/devolucion-fisica-writer");
    const MOTIVO = `SMOKE motivo propio ${Date.now()}`;
    const v = await ventaPagada(2);
    // El descuento de inventario tiene que haber ocurrido para poder devolver: la devolucion saca la unidad
    // de donde la venta la puso.
    const { descontarVenta } = await import("@/modules/payments/data/inventario-de-venta");
    await descontarVenta(v.id);
    // SIN RAMA DE ESCAPE: si la devolución no se puede registrar, el caso FALLA. La primera versión la
    // tragaba con un try/catch y pasaba en verde sin comprobar nada, que es peor que no tener el caso.
    await registrarDevolucionFisica({
      transactionItemId: v.lineaId,
      cantidad: 1,
      motivo: MOTIVO,
      actorId: profileId,
      actorEmail: "smoke@cnv",
      ip: null,
    });
    const r = await lector.loDeshecho();
    const fila = r.motivos.find((m: any) => m.motivo === MOTIVO);
    expect(fila, "el motivo escrito no llegó al agregado").toBeTruthy();
    expect(fila.loEscribioElSistema, "un motivo escrito por una persona no es una nota automática").toBe(false);
    // Y la frase del codigo ya no se cuela como si fuera un motivo.
    for (const m of r.motivos) {
      if (m.loEscribioElSistema) continue;
      expect(m.motivo).not.toMatch(/^Devolución de \d+ de \d+ unidades de la línea\.$/);
    }
  });

  // ═══ LAS DOS CIFRAS DEL MISMO HECHO TIENEN QUE CUADRAR (Santiago, 2026-09-30) ═══
  //
  // La pantalla decia "5 devoluciones" arriba y una sola linea en "que vuelve", sin explicar las otras
  // cuatro: eran de un producto de prueba y el desglose los filtraba. Dos cifras del mismo hecho que no
  // cuadran se leen como un defecto, y con razon, porque la que esta mal es una de las dos.
  it("el desglose por producto cuadra con el conteo de devoluciones", async () => {
    const v = await ventaPagada(3);
    await devolucion({ venta: v.id, linea: v.lineaId, unidades: 2, monto: 50000, nota: "cuadre" });
    const r = await lector.loDeshecho();
    const devoluciones =
      r.porClase.find((c: any) => c.clase === "devolucion")?.veces ?? 0;
    const desglose = r.productosDevueltos.reduce((n: number, p: any) => n + p.veces, 0);
    // El desglose corta en 10 productos, asi que solo se exige la igualdad cuando cabe entero. Con menos de
    // diez filas, una diferencia es un filtro de mas escondido en una de las dos consultas.
    if (r.productosDevueltos.length < 10) expect(desglose).toBe(devoluciones);
    else expect(desglose).toBeLessThanOrEqual(devoluciones);
  });

  // ═══ EL CASO QUE MAS IMPORTA ═══
  //
  // Un link anulado NO es una venta deshecha. Si entrara arriba, la tasa de reversion diria que se deshace
  // mucho mas de lo que se deshace, y la cifra se usaria para decidir.
  it("un link anulado NO cuenta como venta deshecha: va a su propia línea", async () => {
    const antes = await lector.loDeshecho();
    await linkAnulado();
    const despues = await lector.loDeshecho();

    const deshechas = (r: any) => r.porClase.reduce((n: number, c: any) => n + c.veces, 0);
    expect(deshechas(despues) - deshechas(antes)).toBe(0);
    expect(despues.links.aMano - antes.links.aMano).toBe(1);
    // Y TAMPOCO TOCA EL DENOMINADOR: un link anulado nunca fue una venta pagada.
    expect(despues.ventasPagadas - antes.ventasPagadas).toBe(0);
  });

  // Y LA SEGUNDA DISTINCION: un link que se anula porque la venta se cobro en efectivo no es un cambio de
  // opinion. La venta SI ocurrio. Contarlo junto con lo anulado a mano diria que el profesional se arrepiente
  // el doble de lo que se arrepiente.
  it("un link reemplazado por otro cobro no se cuenta como anulado a mano", async () => {
    const antes = await lector.loDeshecho();
    const v = await ventaPagada();
    await linkAnulado({ reemplazadoPor: v.id });
    const despues = await lector.loDeshecho();

    expect(despues.links.reemplazadosPorOtroCobro - antes.links.reemplazadosPorOtroCobro).toBe(1);
    expect(despues.links.aMano - antes.links.aMano).toBe(0);
    // La venta en efectivo SI entra al denominador: ocurrio de verdad.
    expect(despues.ventasPagadas - antes.ventasPagadas).toBe(1);
  });

  // EL DENOMINADOR ES LO QUE CONVIERTE UN CONTEO EN UNA CIFRA LEGIBLE: "3 devoluciones" es excelente sobre
  // mil ventas y alarmante sobre diez.
  it("la venta pagada entra en el denominador", async () => {
    const antes = await lector.loDeshecho();
    await ventaPagada();
    const despues = await lector.loDeshecho();
    expect(despues.ventasPagadas - antes.ventasPagadas).toBe(1);
  });

  // ═══ Y EL PROFESIONAL DE DEMOSTRACION NO CUENTA (0199) ═══
  //
  // ESTE CASO ES DE COMPORTAMIENTO Y NO DE TEXTO, y hace falta que sea asi: el barrido estatico comprueba
  // que el filtro este ESCRITO, y esta semana ya tuvimos un candado que buscaba un nombre y no atrapo el
  // defecto que tenia delante. Que el filtro sirva es otra pregunta, y solo la base la responde.
  it("una venta de un profesional marcado como de demostración deja de contar", async () => {
    await ventaPagada();
    const contando = await lector.loDeshecho();
    try {
      await db.execute(dsql`update professional_profiles set is_test = true where id = ${profId}`);
      const sinDemo = await lector.loDeshecho();
      expect(sinDemo.ventasPagadas).toBeLessThan(contando.ventasPagadas);
    } finally {
      // SE DEVUELVE PASE LO QUE PASE: es un profesional REAL de la base local, y dejarlo marcado apagaria
      // sus cifras en todas las pantallas.
      await db.execute(dsql`update professional_profiles set is_test = false where id = ${profId}`);
    }
  });
});
