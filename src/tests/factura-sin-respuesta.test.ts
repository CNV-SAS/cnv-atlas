import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/core/http/http-error";
import {
  fechaEnColombia,
  pudoHaberseCreado,
  rangoDeBusqueda,
  referenciaDeVenta,
} from "@/modules/payments/facturacion";

// ═══ LA FACTURA QUE SE EMITE Y CUYA RESPUESTA SE PIERDE ═══
//
// Smoke del Bloque 3, 2026-09-14: la emision tardo mas de 15 s, Alegra emitio SETP990214715 y Atlas la dio por
// fallida sin id. Un reintento habria emitido una segunda factura. Aqui las piezas puras y el cliente; el
// servicio contra base real esta en `factura-huerfana-db.test.ts`.

vi.mock("server-only", () => ({}));
vi.mock("@/core/http/fetch-json", () => ({ fetchJson: vi.fn() }));

describe("las piezas puras", () => {
  it("la referencia lleva el id de la venta", () => {
    expect(referenciaDeVenta("abc-123")).toBe("Atlas venta abc-123");
  });

  it("la fecha es la de COLOMBIA: las 02:13 UTC del 14 son el 13", () => {
    // Es la hora a la que se emitio la SETP990214715. Con UTC, la factura habria salido con el dia siguiente.
    expect(fechaEnColombia(new Date("2026-09-14T02:13:45Z"))).toBe("2026-09-13");
    expect(fechaEnColombia(new Date("2026-09-14T05:00:00Z"))).toBe("2026-09-14");
  });

  it("el rango es un dia antes y uno despues, tambien al cambiar de mes y de año", () => {
    expect(rangoDeBusqueda("2026-09-13")).toEqual({ desde: "2026-09-12", hasta: "2026-09-14" });
    expect(rangoDeBusqueda("2026-10-01")).toEqual({ desde: "2026-09-30", hasta: "2026-10-02" });
    expect(rangoDeBusqueda("2026-12-31")).toEqual({ desde: "2026-12-30", hasta: "2027-01-01" });
  });

  it("un 4xx NO pudo haber creado nada; un corte, la red o un 5xx SI", () => {
    expect(pudoHaberseCreado(new HttpError("x", 400, {}))).toBe(false);
    expect(pudoHaberseCreado(new HttpError("x", 422, {}))).toBe(false);
    expect(pudoHaberseCreado(new HttpError("x", 500, {}))).toBe(true);
    expect(pudoHaberseCreado(new DOMException("The operation was aborted due to timeout", "TimeoutError"))).toBe(true);
    expect(pudoHaberseCreado(new TypeError("fetch failed"))).toBe(true);
  });
});

describe("el cliente de Alegra", () => {
  beforeEach(() => {
    process.env.ALEGRA_EMAIL = "x@y.z";
    process.env.ALEGRA_API_KEY = "k";
    process.env.ALEGRA_BASE_URL = "https://sandbox.alegra.com/api/v1";
  });
  afterEach(() => vi.clearAllMocks());

  it("la emision manda la referencia en `observations` (no impresa) y espera 60 s", async () => {
    const { fetchJson } = await import("@/core/http/fetch-json");
    vi.mocked(fetchJson).mockResolvedValue({ id: 1 });
    const { createAlegraInvoice } = await import("@/lib/alegra/client");
    await createAlegraInvoice({
      clientId: 3,
      referencia: "Atlas venta v1",
      items: [{ id: 1, price: 1000, quantity: 1, tax: [{ id: 4 }] }],
      date: "2026-09-14",
      dueDate: "2026-09-14",
      numberTemplateId: 16,
      emitir: true,
    });
    const [, opciones] = vi.mocked(fetchJson).mock.calls[0];
    expect((opciones?.body as Record<string, unknown>).observations).toBe("Atlas venta v1");
    // `anotation` SI se imprime en el PDF: la referencia no puede ir ahi.
    expect((opciones?.body as Record<string, unknown>).anotation).toBeUndefined();
    expect(opciones?.timeoutMs).toBe(60_000);
  });

  it("la busqueda adopta solo la que trae la referencia exacta, e ignora las anuladas", async () => {
    const { fetchJson } = await import("@/core/http/fetch-json");
    vi.mocked(fetchJson).mockResolvedValue([
      { id: 10, status: "closed", observations: null },
      { id: 11, status: "void", observations: "Atlas venta v1" },
      { id: 12, status: "open", observations: "Atlas venta v1", numberTemplate: { fullNumber: "SETP12" } },
      { id: 13, status: "open", observations: "Atlas venta v2" },
    ]);
    const { buscarFacturaPorReferencia } = await import("@/lib/alegra/client");
    const r = await buscarFacturaPorReferencia({ clientId: 3, referencia: "Atlas venta v1", desde: "2026-09-12", hasta: "2026-09-14" });
    expect(r?.id).toBe("12");
    const [url] = vi.mocked(fetchJson).mock.calls[0];
    expect(url).toContain("client_id=3");
    expect(url).toContain("date_afterOrNow=2026-09-12");
    expect(url).toContain("date_beforeOrNow=2026-09-14");
  });

  it("sin coincidencias devuelve null", async () => {
    const { fetchJson } = await import("@/core/http/fetch-json");
    vi.mocked(fetchJson).mockResolvedValue([{ id: 10, status: "open", observations: "Atlas venta otra" }]);
    const { buscarFacturaPorReferencia } = await import("@/lib/alegra/client");
    expect(
      await buscarFacturaPorReferencia({ clientId: 3, referencia: "Atlas venta v1", desde: "a", hasta: "b" }),
    ).toBeNull();
  });

  it("DOS facturas vivas con la misma referencia: no adopta ninguna, lanza para que lo mire una persona", async () => {
    const { fetchJson } = await import("@/core/http/fetch-json");
    vi.mocked(fetchJson).mockResolvedValue([
      { id: 12, status: "open", observations: "Atlas venta v1" },
      { id: 14, status: "closed", observations: "Atlas venta v1" },
    ]);
    const { buscarFacturaPorReferencia } = await import("@/lib/alegra/client");
    await expect(
      buscarFacturaPorReferencia({ clientId: 3, referencia: "Atlas venta v1", desde: "a", hasta: "b" }),
    ).rejects.toThrow(/2 facturas/);
  });

  it("pagina: una cuenta con mas de 30 facturas del cliente no esconde la 31", async () => {
    const { fetchJson } = await import("@/core/http/fetch-json");
    const pagina1 = Array.from({ length: 30 }, (_, i) => ({ id: i, status: "closed", observations: null }));
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(pagina1)
      .mockResolvedValueOnce([{ id: 31, status: "open", observations: "Atlas venta v1" }]);
    const { buscarFacturaPorReferencia } = await import("@/lib/alegra/client");
    const r = await buscarFacturaPorReferencia({ clientId: 3, referencia: "Atlas venta v1", desde: "a", hasta: "b" });
    expect(r?.id).toBe("31");
    expect(vi.mocked(fetchJson).mock.calls[1][0]).toContain("start=30");
  });
});
