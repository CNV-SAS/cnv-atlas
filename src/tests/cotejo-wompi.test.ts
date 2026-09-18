import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { cotejar, type FilaDeWompi, type VentaDeAtlas } from "@/modules/payments/conciliacion";

vi.mock("server-only", () => ({}));

// ═══ EL COTEJO CON WOMPI: A QUIEN SE LE SELLA EL PAGO Y A QUIEN NO (Bloque 3b, sesion 3) ═══
//
// Wompi reintenta su webhook 3 veces en 24 horas y despues no mas: una venta cobrada cuyo webhook se perdio queda
// sin sellar, sin factura y sin comision, y nadie se entera (paso el 2026-09-15). El cotejo la recupera.
//
// LA REGLA QUE SE PROTEGE AQUI: recuperar un pago es ESCRIBIR PLATA, asi que ante la duda no se sella. Un monto
// que no cuadra se anota para que lo mire una persona, nunca se aplica.

const venta = (over: Partial<VentaDeAtlas> = {}): VentaDeAtlas => ({
  id: "venta-1",
  estado: "esperando",
  monto: "11900",
  ...over,
});

const fila = (over: Partial<FilaDeWompi> = {}): FilaDeWompi => ({
  id: "wompi-1",
  reference: "venta-1",
  status: "APPROVED",
  amount_in_cents: 1_190_000,
  payment_method_type: "CARD",
  payment_method: { extra: { card_type: "CREDIT" } },
  ...over,
});

describe("a quien recupera el cotejo", () => {
  it("una venta esperando que Wompi aprobo por el mismo monto SE RECUPERA, con su metodo y su tarjeta", () => {
    const r = cotejar([venta()], [fila()]);
    expect(r.recuperar).toEqual([{ ventaId: "venta-1", wompiId: "wompi-1", metodo: "CARD", tipoDeTarjeta: "CREDIT" }]);
    expect(r.discrepancias).toEqual([]);
  });

  it("una venta que nadie pago no es un problema: no se recupera ni se reporta", () => {
    const r = cotejar([venta()], []);
    expect(r).toEqual({ recuperar: [], discrepancias: [] });
  });

  it("CON EL MONTO DISTINTO NO SE SELLA: queda anotada para que la mire una persona", () => {
    const r = cotejar([venta()], [fila({ amount_in_cents: 990_000 })]);
    expect(r.recuperar, "sellar otra cifra descuadra ingreso, comision y factura").toEqual([]);
    expect(r.discrepancias[0].motivo).toContain("990000");
    expect(r.discrepancias[0].motivo).toContain("1190000");
  });

  it("una aprobada de OTRA venta no contamina a esta: se empareja por la referencia", () => {
    const r = cotejar([venta()], [fila({ reference: "otra-venta" }), fila({ id: "w2", reference: null })]);
    expect(r).toEqual({ recuperar: [], discrepancias: [] });
  });

  it("un intento RECHAZADO y otro APROBADO de la misma venta: manda el aprobado", () => {
    const r = cotejar([venta()], [fila({ id: "w-rechazado", status: "DECLINED" }), fila({ id: "w-ok" })]);
    expect(r.recuperar.map((x) => x.wompiId)).toEqual(["w-ok"]);
  });

  it("una venta ANULADA que igual se pago tambien se recupera: es el caso que mas duele", () => {
    // En Atlas quedo `failed` al anular el link, y el pago entro de todos modos. Recuperarla la manda a revision.
    const r = cotejar([venta({ estado: "esperando" })], [fila()]);
    expect(r.recuperar).toHaveLength(1);
  });
});

describe("lo que el cotejo solo ANOTA, sin tocar", () => {
  it("Atlas la tiene pagada y Wompi dice VOIDED: se reporta, no se revierte (eso es la sesion 1)", () => {
    const r = cotejar([venta({ estado: "pagada" })], [fila({ status: "VOIDED" })]);
    expect(r.recuperar).toEqual([]);
    expect(r.discrepancias).toEqual([
      { ventaId: "venta-1", wompiId: "wompi-1", motivo: "Atlas la tiene pagada y Wompi dice VOIDED." },
    ]);
  });

  it("CONTROL: pagada en Atlas y aprobada en Wompi es lo normal, y no reporta nada", () => {
    const r = cotejar([venta({ estado: "pagada" })], [fila()]);
    expect(r).toEqual({ recuperar: [], discrepancias: [] });
  });

  it("CONTROL: un rechazo sobre una venta que Atlas NO tiene pagada tampoco reporta nada", () => {
    const r = cotejar([venta()], [fila({ status: "DECLINED" })]);
    expect(r).toEqual({ recuperar: [], discrepancias: [] });
  });
});

// ═══ EL CLIENTE: que le pide a Wompi y que hace con lo que recibe ═══
//
// El listado de transacciones de Wompi NO esta documentado (la documentacion publica describe el de
// dispersiones). Lo que sabemos salio de un sondeo contra el sandbox, y estos candados lo dejan escrito: si Wompi
// cambia, aqui se ve.

describe("el cliente de consulta de Wompi", () => {
  const llamadas: string[] = [];
  let respuesta: { status: number; body: unknown } = { status: 200, body: { data: [] } };

  beforeEach(() => {
    vi.resetModules();
    llamadas.length = 0;
    process.env.WOMPI_PRIVATE_KEY = "prv_test_abc";
    vi.stubGlobal("fetch", async (url: string) => {
      llamadas.push(String(url));
      return new Response(JSON.stringify(respuesta.body), {
        status: respuesta.status,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WOMPI_PRIVATE_KEY;
  });

  it("manda los CUATRO parametros que el listado exige, y al sandbox si la llave es de prueba", async () => {
    const { listarTransacciones } = await import("@/lib/wompi/client");
    respuesta = { status: 200, body: { data: [] } };
    const r = await listarTransacciones(new Date("2026-09-10T00:00:00Z"), new Date("2026-09-13T00:00:00Z"));
    expect(r.ok).toBe(true);
    expect(llamadas[0]).toContain("https://sandbox.wompi.co/v1/transactions?");
    for (const p of ["from_date=", "until_date=", "page=1", "page_size=200"]) {
      expect(llamadas[0], `sin ${p} Wompi responde 422`).toContain(p);
    }
  });

  it("al buscar por referencia VUELVE A COMPARARLA: un filtro que deje de filtrar no puede sellar otra venta", async () => {
    const { buscarPorReferencia } = await import("@/lib/wompi/client");
    respuesta = {
      status: 200,
      body: { data: [{ id: "w-otra", reference: "otra-venta", status: "APPROVED", amount_in_cents: 100 }] },
    };
    const r = await buscarPorReferencia("la-mia", new Date("2026-09-10"), new Date("2026-09-13"));
    expect(r.ok && r.value, "devolvio la transaccion de otra venta").toBeNull();
  });

  it("un error de Wompi NO se confunde con 'no hay pagos': devuelve fallo", async () => {
    const { listarTransacciones } = await import("@/lib/wompi/client");
    respuesta = { status: 500, body: { error: "boom" } };
    const r = await listarTransacciones(new Date("2026-09-10"), new Date("2026-09-13"));
    expect(r.ok, "un fallo tomado por 'nada que recuperar' deja el hueco abierto en silencio").toBe(false);
  });

  it("con la llave PUBLICA no consulta: Wompi responde 404 y seria un fallo mudo", async () => {
    process.env.WOMPI_PRIVATE_KEY = "pub_test_abc";
    const { listarTransacciones, ambienteDeLaLlave } = await import("@/lib/wompi/client");
    expect(ambienteDeLaLlave()).toBeNull();
    const r = await listarTransacciones(new Date("2026-09-10"), new Date("2026-09-13"));
    expect(r.ok).toBe(false);
    expect(llamadas, "no deberia ni intentarlo").toEqual([]);
  });
});

describe("la anulación que Wompi hace sobre una venta ya pagada", () => {
  it("SE DETECTA AUNQUE HAYA OTRO INTENTO APROBADO, mirando la transaccion que pago (smoke del 2026-09-17)", () => {
    const pagada = venta({ estado: "pagada", wompiId: "w-la-que-pago" });
    const r = cotejar(
      [pagada],
      [fila({ id: "w-la-que-pago", status: "VOIDED" }), fila({ id: "w-otro-intento", status: "APPROVED" })],
    );
    expect(r.discrepancias, "con otra aprobada del mismo link, la anulacion pasaba en silencio").toEqual([
      { ventaId: "venta-1", wompiId: "w-la-que-pago", motivo: "Atlas la tiene pagada y Wompi dice VOIDED." },
    ]);
  });

  it("CONTROL: si la anulada es OTRA transaccion y la que pago sigue aprobada, no se reporta nada", () => {
    const pagada = venta({ estado: "pagada", wompiId: "w-la-que-pago" });
    const r = cotejar([pagada], [fila({ id: "w-la-que-pago" }), fila({ id: "w-un-intento-viejo", status: "VOIDED" })]);
    expect(r.discrepancias).toEqual([]);
  });

  it("sin saber cual transaccion pago (ventas viejas), se cae a la regla anterior", () => {
    const r = cotejar([venta({ estado: "pagada", wompiId: null })], [fila({ status: "VOIDED" })]);
    expect(r.discrepancias).toHaveLength(1);
  });
});
