import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ═══ EL LINK DE PAGO, CUANDO SU LECTURA FALLA (2026-09-14) ═══
//
// La API de Supabase respondio 502 de forma intermitente al abrir el link, y el paciente veia el error generico.
// Ahora ve que hacer y tiene con que hacerlo; y el fallo sigue llegando a Sentry, que es donde se esta midiendo.

const leer = vi.fn();
const reportar = vi.fn();
const armarWompi = vi.fn();

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/modules/payments/data/checkout-reader", () => ({ getCheckoutByToken: (t: string) => leer(t) }));
vi.mock("@/lib/observability/report-error", () => ({ reportServerError: (a: string, e: unknown) => reportar(a, e) }));
vi.mock("@/modules/payments/services/payments-service", () => ({ buildWompiCheckoutParams: (v: unknown) => armarWompi(v) }));

const { default: CheckoutPage } = await import("@/app/checkout/[token]/page");

async function render(token: string): Promise<string> {
  return renderToStaticMarkup(await CheckoutPage({ params: Promise.resolve({ token }) }));
}

describe("link de pago con la lectura fallida", () => {
  beforeEach(() => {
    leer.mockReset();
    reportar.mockReset();
    armarWompi.mockReset();
  });

  it("dice que intente de nuevo y le da el boton, que vuelve al mismo link", async () => {
    leer.mockRejectedValue(new Error("checkout-reader: getCheckoutByToken: Bad Gateway"));
    const html = await render("tok en/raro");
    expect(html).toContain("No pudimos cargar tu link de pago");
    expect(html).toContain("Intenta de nuevo en unos");
    expect(html).toContain('href="/checkout/tok%20en%2Fraro"');
    expect(html).toContain("Intentar de nuevo");
    expect(html).not.toContain("Link no disponible");
  });

  it("y lo reporta a Sentry con su area", async () => {
    const error = new Error("Bad Gateway");
    leer.mockRejectedValue(error);
    await render("t");
    expect(reportar).toHaveBeenCalledWith("checkout.leer-link", error);
  });

  it("CONTROL: un link que no existe sigue diciendo 'no disponible', no 'intenta de nuevo'", async () => {
    leer.mockResolvedValue(null);
    const html = await render("t");
    expect(html).toContain("Link no disponible");
    expect(html).not.toContain("Intentar de nuevo");
    expect(reportar).not.toHaveBeenCalled();
  });

  it("un error de configuracion NO se disfraza de pasajero: sigue lanzando", async () => {
    leer.mockResolvedValue({ amountInCents: 100 });
    armarWompi.mockImplementation(() => {
      throw new Error("Falta WOMPI_INTEGRITY_SECRET");
    });
    await expect(render("t")).rejects.toThrow(/WOMPI_INTEGRITY_SECRET/);
  });
});
