import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ UNA VENTA A DOMICILIO NO SE ENTREGA SIN DIRECCION (legal, 2026-10-08) ═══
//
// ── EL CASO REAL ──────────────────────────────────────────────────────────────────────────────────
//
// En el punto 10 del primer smoke, admin marco como ENTREGADA una venta que salio de la bodega y para la que
// nunca existio una direccion en ninguna parte. Legal lo llamo lo mas grave del hallazgo: *"el sistema permitio
// cerrar el ciclo de una entrega que nadie sabia a donde iba"*, y lo pidio como validacion DURA, no como aviso.
//
// ── LAS TRES COSAS QUE ESTE CANDADO FIJA, Y POR QUE SON TRES ─────────────────────────────────────
//
//   1. QUE EL PORTON ESTE. Sin direccion no se entrega.
//   2. QUE EXISTA LA SALIDA. Un guard sin una superficie que lo satisfaga no protege, BLOQUEA: cuando puse el
//      porton, no habia NINGUNA via para registrar la direccion despues de la venta, asi que toda venta desde
//      la bodega habria quedado imposible de entregar para siempre. Lo encontre al revisar si alguien podia
//      cumplir el porton, no al escribirlo.
//   3. Y QUE EL CAMINO COMPLETO SE PUEDA RECORRER: registrar el destino y despues entregar. Probar solo el
//      rechazo deja pasar un arreglo que bloquee las dos cosas.
//
// VA CONTRA LA BASE REAL porque la capa de abajo es un CHECK (0213) y lo que importa es que las DOS capas digan
// lo mismo: el servicio con una frase que dice que hacer, y la base para que el camino no exista.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `ENV-${Date.now()}`;

describe.skipIf(!HAS_DB)("el envio no se entrega sin direccion (BD real)", () => {
  let db: typeof import("@/db").db;
  let writer: typeof import("@/modules/payments/data/payments-writer");
  let destino: typeof import("@/modules/payments/data/destino-del-envio-writer");
  let orgId: string;
  let actorId: string;
  const creadas: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/payments/data/payments-writer");
    destino = await import("@/modules/payments/data/destino-del-envio-writer");
    const [fila] = await db.execute<{ organization_id: string; id: string }>(dsql`
      select p.organization_id, p.id from profiles p
       where p.organization_id is not null limit 1`);
    orgId = fila.organization_id;
    actorId = fila.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    for (const id of creadas) {
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
  });

  /** Una venta a domicilio PAGADA y pendiente de despacho, sin direccion: el estado en que nace hoy. */
  async function ventaSinDireccion(): Promise<string> {
    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions
        (organization_id, status, amount, currency, payment_method, wompi_env, idempotency_key,
         delivery_mode, fulfillment_state, stock_state)
      values (${orgId}, 'paid', '107100', 'COP', 'efectivo', 'test',
              ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`},
              'domicilio', 'pendiente', 'descontado')
      returning id`);
    creadas.push(t.id);
    return t.id;
  }

  it("el servicio lo rechaza, y con una frase que dice que hacer", async () => {
    const id = await ventaSinDireccion();
    const r = await writer.registrarEntrega(id, { id: actorId, email: null });
    expect(r, "se pudo cerrar una entrega sin saber a donde iba").toBe("sin_direccion");
    // Y NO LA TOCO: un rechazo que deja la venta a medias seria peor que no rechazar.
    const [v] = await db.execute<{ fulfillment_state: string }>(dsql`
      select fulfillment_state from transactions where id = ${id}`);
    expect(v.fulfillment_state).toBe("pendiente");
  });

  it("y la base lo impide aunque alguien llegue por SQL directo", async () => {
    const id = await ventaSinDireccion();
    // LA SEGUNDA CAPA: el CHECK de la 0213. Sin el, el porton seria una regla de la aplicacion y un script
    // cualquiera podria cerrar la entrega igual.
    // EL NOMBRE DE LA RESTRICCION VA EN LA CAUSA, no en el mensaje: Drizzle envuelve el error de Postgres y su
    // propio mensaje es solo "Failed query: ...". Un `toThrow(/nombre/)` pasa a verde por el motivo equivocado
    // o falla sin explicar; esto ya nos costo una vez.
    let causa = "";
    try {
      await db.execute(dsql`
        update transactions set fulfillment_state = 'entregado', delivered_at = now() where id = ${id}`);
    } catch (e) {
      causa = String((e as { cause?: unknown }).cause ?? e);
    }
    expect(causa, "la base dejo cerrar la entrega sin direccion").toContain(
      "transactions_domicilio_entregado_con_direccion",
    );
  });

  it("pero EXISTE la salida: se registra el destino y entonces si se entrega", async () => {
    // ESTE ES EL CASO QUE EVITA QUE EL PORTON SEA UN DEFECTO. Cuando lo escribi no habia ninguna via para
    // registrar la direccion despues de la venta: sin esto, el candado anterior pasaria verde sobre un flujo
    // completamente trabado.
    const id = await ventaSinDireccion();
    const r = await destino.registrarDestinoDelEnvio(
      id,
      { ciudad: "Medellín", departamento: "Antioquia", direccion: "Calle 10 # 20-30, apto 501", celular: "3001234567" },
      { id: actorId, email: null },
    );
    expect(r).toBe("registrado");

    expect(await writer.registrarEntrega(id, { id: actorId, email: null })).toBe("entregada");
    const [v] = await db.execute<{ fulfillment_state: string; shipping_address: string }>(dsql`
      select fulfillment_state, shipping_address from transactions where id = ${id}`);
    expect(v.fulfillment_state).toBe("entregado");
    expect(v.shipping_address).toContain("Calle 10");
  });

  it("y una direccion a medias no cuenta como direccion", async () => {
    // Si se admitiera, el porton se pasaria con basura y quedaria un envio igual de imposible de despachar,
    // pero esta vez con cara de resuelto.
    const id = await ventaSinDireccion();
    expect(
      await destino.registrarDestinoDelEnvio(
        id,
        { ciudad: "Medellín", direccion: "abc" },
        { id: actorId, email: null },
      ),
    ).toBe("direccion_vacia");
    expect(await writer.registrarEntrega(id, { id: actorId, email: null })).toBe("sin_direccion");
  });

  it("y el destino de una venta YA ENTREGADA no se reescribe", async () => {
    // Su destino es parte de lo que paso. Corregirlo despues seria reescribir el hecho, no completarlo.
    const id = await ventaSinDireccion();
    await destino.registrarDestinoDelEnvio(
      id,
      { ciudad: "Cali", direccion: "Carrera 5 # 6-7" },
      { id: actorId, email: null },
    );
    await writer.registrarEntrega(id, { id: actorId, email: null });
    expect(
      await destino.registrarDestinoDelEnvio(
        id,
        { ciudad: "Bogotá", direccion: "Otra dirección cualquiera" },
        { id: actorId, email: null },
      ),
    ).toBe("ya_entregada");
  });
});
