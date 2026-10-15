import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ EL BARRIDO DE /pagos: LOS OCHO LECTORES, UNO POR UNO (Santiago, 2026-10-14) ═══
//
// DE DONDE SALE. Santiago marco los pacientes de prueba y a admin le seguian apareciendo, en el lado REAL
// del interruptor: *"2 Devueltas pendientes de verificacion, 5 ventas por revisar, 1 Ventas cobradas sin
// cerrar en contabilidad"*. Y la frase que apunta al defecto: *"se supone que admin en /pagos tenia un boton
// que mostraba lo de prueba y lo real, pero mira que aqui aparece en lo real cosas que ya estan marcadas"*.
//
// Asi que esto no prueba una funcion: prueba la PANTALLA, lector por lector. Es un candado de BARRIDO, de la
// familia de [[una-regla-tambien-vive-en-varios-sitios]]: la regla es una y vive en ocho sitios, y lo que
// falla es siempre el sitio donde nadie la aplico.
//
// ── LOS OCHO, Y QUE LE PASABA A CADA UNO ────────────────────────────────────────────────────────
//
//   1. Historial de transacciones   `listTransactions`                 ya filtraba
//   2. Ventas cobradas sin cerrar   `listarVentasSinDocumento`          ya filtraba
//   3. Los chips de "dias con..."   `contarVentasSinDocumentoPorDia`    NO filtraba  <- contradecia al 2
//   4. Ventas por revisar           `listarVentasPorRevisar`            filtraba por PRODUCTO las 3 ramas
//   5. Pendientes sin salida        `listarPendientesDeAccion`          sin interruptor
//   6. Efectivo no recibido         `listarEfectivosNoRecibidos`        NO filtraba nada
//   7. Reversas                     `listarReversas`                    ya filtraba
//   8. Devueltas pendientes         `listarDevueltasPendientes`         NO filtraba nada (y no lee ventas)
//
// Y EL NOVENO, QUE NO ES UN PANEL Y ERA EL GRAVE: la cola de facturacion. Su unico freno mira el PACIENTE,
// asi que una venta marcada a mano con paciente real se iba a facturar en Alegra PRODUCCION.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("lo de prueba no llega a /pagos (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let marca: any;
  let vpr: any;
  let fr: any;
  let avisos: any;
  let orgId = "";
  let profId = "";
  let actorId = "";
  const nutraId = "77777777-7777-7777-7777-777777777702";
  const ventas: string[] = [];
  const pacientes: string[] = [];

  const MOTIVO = "Smoke anterior a produccion, marcada por el candado";

  /** Una venta PAGADA de producto REAL a paciente REAL: la que no se puede derivar de nada. */
  async function ventaReal(extra: Record<string, unknown> = {}): Promise<string> {
    const cols = Object.keys(extra);
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, professional_id, patient_id, status, amount, currency,
                                payment_method, wompi_env, operated_at, idempotency_key)
      values (${orgId}, ${profId}, null, 'paid', '119000', 'COP', 'efectivo', 'produccion', now(),
              ${`barrido-pagos-${Date.now()}-${Math.random().toString(36).slice(2)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality,
                                     vat_rate, commission_rate, supplier_share,
                                     base_amount, commission_amount, supplier_amount, cnv_amount, sealed_at)
      values (${t.id}, ${nutraId}, 1, '119000', 'comision', '0.19', '0.20', '0',
              '100000', '20000', '0', '80000', now())`);
    // LAS COLUMNAS EXTRA VAN EN UN SOLO UPDATE, no una por una: varios CHECK de esta tabla exigen que dos
    // columnas viajen juntas (`cash_not_received_at` con su `..._by`), asi que escribirlas por separado
    // rompe en el estado intermedio. Es el mismo tropiezo que la marca de prueba del paciente.
    if (cols.length > 0) {
      const sets = cols.map((c) => dsql`${dsql.raw(`"${c}"`)} = ${extra[c] as any}`);
      await db.execute(dsql`update transactions set ${dsql.join(sets, dsql`, `)} where id = ${t.id}`);
    }
    return t.id;
  }

  const marcar = (id: string) =>
    marca.marcarVentaComoPrueba({ transactionId: id, motivo: MOTIVO, actorId, actorEmail: null, ip: null });

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    marca = await import("@/modules/payments/data/marca-de-prueba-de-la-venta");
    vpr = await import("@/modules/payments/data/ventas-por-revisar");
    fr = await import("@/modules/payments/data/facturacion-repository");
    avisos = await import("@/modules/avisos/data/avisos-repository");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false
       order by pp.created_at limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
  }, 30_000);

  // LA LIMPIEZA VA EN UNA TRANSACCION, y no es cosmetica: `session_replication_role` es de SESION, y cada
  // `db.execute` suelto puede salir por OTRA conexion del pool. Fuera de una transaccion, el permiso se daba
  // en una conexion y el delete corria en otra, con los triggers vivos, asi que el append-only del audit log
  // lo rechazaba. Dentro, las cuatro sentencias comparten conexion.
  afterEach(async () => {
    await db.transaction(async (tx: any) => {
      await tx.execute(dsql`set local session_replication_role = replica`);
      for (const id of ventas) {
        await tx.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
        await tx.execute(dsql`delete from pending_discards where transaction_id = ${id}::uuid`);
        await tx.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
        await tx.execute(dsql`delete from transactions where id = ${id}`);
      }
      for (const id of pacientes) {
        await tx.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
        await tx.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
        await tx.execute(dsql`delete from patients where id = ${id}`);
      }
    });
    ventas.length = 0;
    pacientes.length = 0;
  });

  // ── 4 · LA BANDEJA: SU FILTRO NO ES EL MISMO PARA LAS TRES RAMAS ───────────────────────────────
  //
  // EL DEFECTO EXACTO: el filtro de producto estaba suelto arriba, aplicandose a las tres. "Pago sobre link
  // anulado" no habla de unidades, habla de una decision sobre dinero, y de una venta de prueba no hay nada
  // que decidir. Con el filtro de producto, seguia pidiendo accion porque el producto era real.
  it("una revision pendiente de una venta MARCADA sale de la bandeja de ventas por revisar", async () => {
    const id = await ventaReal({ review_reason: "pago_sobre_link_anulado", review_opened_at: new Date().toISOString() });
    const antes = await vpr.listarVentasPorRevisar();
    expect(
      antes.some((v: any) => v.id === id),
      "antes de marcarla tiene que estar: si no, el candado no prueba nada",
    ).toBe(true);

    await marcar(id);
    const despues = await vpr.listarVentasPorRevisar();
    expect(
      despues.some((v: any) => v.id === id),
      "una DECISION sobre dinero de una venta declarada de prueba no es un pendiente de nadie",
    ).toBe(false);
  }, 30_000);

  // ── Y LA EXCEPCION FISICA, QUE SE RETIRO EL 15 (0221) ──────────────────────────────────────────
  //
  // ESTE CANDADO DECIA LO CONTRARIO HASTA AYER, y conviene dejar escrito por que cambio.
  //
  // Decia: un `sin_saldo` de producto REAL sigue en la bandeja aunque el paciente sea de prueba, porque la
  // unidad salio del estante de verdad. El argumento es cierto. Lo que no era cierto es que sirviera: con el
  // arranque corrido, admin descarto las cinco filas que quedaban y las siguio viendo en el lado REAL.
  //
  // Y el smoke se hace con pacientes de prueba sobre vitrinas REALES, asi que cada venta sin saldo de una
  // prueba levanta un descuadre que nadie va a ir a contar. Textual de Santiago: *"si algo esta marcado como
  // prueba, aparece en el filtro de prueba, es asi de simple"*.
  //
  // EL HUECO FISICO NO QUEDA SIN SITIO: lo cuadra un movimiento de `conciliacion` por ubicacion. Lo que se
  // movio no es la verdad del descuadre, es DONDE se pide la cuenta.
  it("un 'sin saldo' de producto REAL sale del lado real si su paciente es de prueba", async () => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number, is_test,
                            test_marked_at, test_marked_by, test_proposed_at, test_proposed_by,
                            test_proposed_reason)
      values (${orgId}, 'CC', ${`ZZ-BARRIDO-${Date.now()}`}, true,
              now(), ${actorId}, now(), ${actorId}, 'paciente de prueba del candado')
      returning id`);
    pacientes.push(p.id);
    const id = await ventaReal({ stock_state: "sin_saldo", patient_id: p.id });

    const [f] = await db.execute(dsql`select cuenta_como_de_prueba as p from transactions where id = ${id}`);
    expect(f.p, "la venta ya cuenta como de prueba, por su paciente").toBe(true);

    expect(
      (await vpr.listarVentasPorRevisar()).some((v: any) => v.id === id),
      "una venta de prueba volvio a pedir accion en el lado real de la bandeja",
    ).toBe(false);
    expect(
      (await avisos.listarPendientesDeAccion({ incluirDescartados: true })).some(
        (x: any) => x.transactionId === id,
      ),
      "y en el panel de pendientes tampoco: era la otra mitad de la misma queja",
    ).toBe(false);

    // Y NO SE VUELVE INVISIBLE, que es la unica forma de que esto fuera peor: el interruptor la muestra, en
    // los dos paneles. Esconder algo abierto en las dos vistas es como se pierde un caso de verdad.
    expect(
      (await vpr.listarVentasPorRevisar(true)).some((v: any) => v.id === id),
      "con el interruptor encendido la bandeja tiene que mostrarla",
    ).toBe(true);
    expect(
      (await avisos.listarPendientesDeAccion({ incluirDescartados: true, incluirDePrueba: true })).some(
        (x: any) => x.transactionId === id,
      ),
      "un interruptor que cubre la mitad de la pantalla es peor que no tenerlo",
    ).toBe(true);
  }, 30_000);

  // ── Y LOS DESCARTES QUE YA SE ESCRIBIERON NO PUEDEN ESTORBAR DESPUES (Santiago, 2026-10-15) ────
  //
  // SU PREGUNTA, literal: *"verifica que los descartes que ya escribio no estorben despues"*. Alcanzo a
  // descartar las cinco filas de prueba antes de que la regla cambiara, y esas filas de `pending_discards`
  // se quedan en la base (son historial: no se borran, se revocan).
  //
  // LO QUE HAY QUE PROBAR es que un descarte no puede callar NADA mas que su propio hecho: su fila nombra una
  // transaccion y una huella. Si por alguna razon alcanzara a otra venta, un descuadre real de mañana
  // quedaria mudo por un juicio que se hizo sobre otra cosa, y ese es el fallo silencioso que no se ve venir.
  it("un descarte calla SU hecho y ninguno mas", async () => {
    const descartada = await ventaReal({ stock_state: "sin_saldo" });
    const otra = await ventaReal({ stock_state: "sin_saldo" });

    await avisos.descartarPendiente({
      tipo: "sin_saldo",
      transactionId: descartada,
      motivo: "Contada la vitrina y cuadrada: era del periodo de pruebas.",
      actorId,
      actorEmail: null,
    });

    const bandeja = await vpr.listarVentasPorRevisar();
    expect(bandeja.some((v: any) => v.id === descartada), "el descarte no callo su propio hecho").toBe(false);
    expect(
      bandeja.some((v: any) => v.id === otra),
      "un descarte callo una venta que nadie juzgo: cualquier descuadre real quedaria mudo",
    ).toBe(true);
  }, 30_000);

  // ── 5 · LOS AVISOS: LA MISMA FUNCION QUE LA BANDEJA, Y NO DOS CONDICIONES PARECIDAS ────────────
  //
  // Es el defecto que ya se pago una vez: la LUVIA se veia en un panel y no se podia descartar en el otro.
  it("la bandeja y los avisos dicen LO MISMO de la misma venta", async () => {
    const id = await ventaReal({ stock_state: "sin_saldo" });
    const enBandeja = (await vpr.listarVentasPorRevisar()).some((v: any) => v.id === id);
    const enAvisos = (await avisos.listarPendientesDeAccion({ incluirDescartados: true })).some(
      (p: any) => p.transactionId === id && p.tipo === "sin_saldo",
    );
    expect(enBandeja, "el producto es real: tiene que estar en los dos").toBe(true);
    expect(enAvisos).toBe(enBandeja);

    await marcar(id);
    const enBandeja2 = (await vpr.listarVentasPorRevisar()).some((v: any) => v.id === id);
    const enAvisos2 = (await avisos.listarPendientesDeAccion({ incluirDescartados: true })).some(
      (p: any) => p.transactionId === id,
    );
    expect(enBandeja2).toBe(false);
    expect(enAvisos2, "si uno la esconde y el otro no, vuelve el defecto de la LUVIA").toBe(enBandeja2);
  }, 30_000);

  // EL INTERRUPTOR, que era la otra mitad de la queja: encendido tiene que mostrarla, porque esconder algo
  // ABIERTO lo vuelve invisible.
  it("el interruptor la vuelve a mostrar, en la bandeja Y en los avisos", async () => {
    const id = await ventaReal({ stock_state: "sin_saldo" });
    await marcar(id);
    expect((await vpr.listarVentasPorRevisar(true)).some((v: any) => v.id === id)).toBe(true);
    expect(
      (await avisos.listarPendientesDeAccion({ incluirDescartados: true, incluirDePrueba: true })).some(
        (p: any) => p.transactionId === id,
      ),
      "un interruptor que cubre la mitad de la pantalla es peor que no tenerlo",
    ).toBe(true);
  }, 30_000);

  // ── 6 · EL EFECTIVO NO RECIBIDO: no filtraba NADA, y ademas cuenta una ESCALADA ────────────────
  it("un efectivo no recibido de una venta marcada no pide nota credito ni cuenta para la escalada", async () => {
    const id = await ventaReal({
      cash_not_received_at: new Date().toISOString(),
      cash_not_received_by: actorId,
    });
    expect((await vpr.listarEfectivosNoRecibidos()).some((e: any) => e.id === id)).toBe(true);

    await marcar(id);
    const lista = await vpr.listarEfectivosNoRecibidos();
    expect(lista.some((e: any) => e.id === id), "de una venta de prueba no entro ni dejo de entrar nada").toBe(
      false,
    );
    // Y LA CUENTA DE LA ESCALADA SIGUE EL MISMO FILTRO QUE LA LISTA: es el numero con el que se le escala al
    // Integrante, asi que en una fila REAL no puede traer casos de prueba dentro.
    const conInterruptor = await vpr.listarEfectivosNoRecibidos(true);
    const fila = conInterruptor.find((e: any) => e.id === id);
    expect(fila, "encendido si se ve la fila").toBeDefined();
    expect(fila.casosEn90Dias).toBeGreaterThanOrEqual(1);

    const otra = await ventaReal({
      cash_not_received_at: new Date().toISOString(),
      cash_not_received_by: actorId,
    });
    await marcar(id);
    const real = (await vpr.listarEfectivosNoRecibidos()).find((e: any) => e.id === otra);
    expect(
      real?.casosEn90Dias,
      "la fila real no puede contar la marcada: seria escalarle a alguien por data inventada",
    ).toBe(1);
  }, 30_000);

  // ── 3 · LOS CHIPS CONTRA LA LISTA: dos partes de la pantalla que leian fuentes distintas ───────
  //
  // El sintoma era el del hazard 4: arriba "(3)" y al pulsarlo "Ese dia quedo en cero".
  it("los chips de dias cuentan lo mismo que la lista de abajo", async () => {
    const id = await ventaReal({ alegra_invoice_state: "pendiente" });
    const hoy = (
      await db.execute(dsql`select (now() at time zone 'America/Bogota')::date::text as d`)
    )[0].d as string;

    const chipAntes = (await fr.contarVentasSinDocumentoPorDia(30)).find((c: any) => c.dia === hoy);
    const listaAntes = await fr.listarVentasSinDocumento(500, hoy);
    expect(chipAntes?.total ?? 0).toBe(listaAntes.length);

    await marcar(id);
    const chip = (await fr.contarVentasSinDocumentoPorDia(30)).find((c: any) => c.dia === hoy);
    const lista = await fr.listarVentasSinDocumento(500, hoy);
    expect(lista.some((v: any) => v.id === id)).toBe(false);
    expect(
      chip?.total ?? 0,
      "un chip que dice (3) y una lista que dice 'quedo en cero' son dos fuentes, no un mensaje mal escrito",
    ).toBe(lista.length);
  }, 30_000);

  // ── EL NOVENO, Y EL GRAVE: LA COLA QUE DE VERDAD EMITE ─────────────────────────────────────────
  //
  // Sin esto, el arranque habria mandado a Alegra PRODUCCION las ventas que el script marca, con numeracion
  // de la DIAN. El freno que ya existia mira el PACIENTE, y este caso es de paciente REAL.
  it("una venta marcada a mano NO entra a la cola de facturacion", async () => {
    const id = await ventaReal({ alegra_invoice_state: "pendiente" });
    const cola1 = await fr.listarFacturasPendientes(5, 1_000_000);
    expect(cola1.some((c: any) => c.id === id), "antes de marcarla esta en la cola").toBe(true);

    await marcar(id);
    const cola2 = await fr.listarFacturasPendientes(5, 1_000_000);
    expect(
      cola2.some((c: any) => c.id === id),
      "una factura fiscal afirmaria un acto que ya se declaro que no ocurrio",
    ).toBe(false);
  }, 30_000);

  // Y EL FRENO GEMELO, para el boton de "Reintentar" y el webhook, que no pasan por la cola.
  it("y el freno del acto no depende del ambiente, a diferencia del del paciente", async () => {
    const { laVentaFueMarcadaComoPrueba } = await import("@/modules/payments/facturacion");
    expect(laVentaFueMarcadaComoPrueba(null)).toBeNull();
    expect(laVentaFueMarcadaComoPrueba(new Date())).toMatch(/ningún ambiente/i);

    const id = await ventaReal();
    expect(await fr.getMarcaDePruebaDeLaVenta(id)).toBeNull();
    await marcar(id);
    expect(await fr.getMarcaDePruebaDeLaVenta(id)).not.toBeNull();
  }, 30_000);
});
