import { describe, expect, it, vi } from "vitest";

// ═══ UNA CONSULTA QUE NO LLEGA NO PUEDE COLGAR LA PANTALLA (2026-09-16) ═══
//
// /pagos se quedo cargando hasta que Vercel la corto: "504 FUNCTION_INVOCATION_TIMEOUT". Un cuelgue no deja error
// ni nombre, y esa pantalla arma ocho consultas, asi que no se supo cual fue. `conLimite` le pone tope y nombre a
// cada una: la que no llega se reporta y la pantalla sigue.

vi.mock("server-only", () => ({}));
const reportados: string[] = [];
vi.mock("@/lib/observability/report-error", () => ({
  reportServerError: (area: string) => {
    reportados.push(area);
  },
}));

const { conLimite } = await import("@/lib/observability/con-limite");

describe("conLimite", () => {
  it("devuelve el dato cuando la carga responde, y no reporta nada", async () => {
    reportados.length = 0;
    const r = await conLimite("prueba.rapida", async () => [1, 2], [] as number[], 50);
    expect(r).toEqual({ dato: [1, 2], fallo: false });
    expect(reportados).toEqual([]);
  });

  it("la que NO responde a tiempo devuelve el respaldo, avisa que fallo y queda reportada con su nombre", async () => {
    reportados.length = 0;
    const eterna = () => new Promise<number[]>(() => {});
    const r = await conLimite("pagos.ventas-por-revisar", eterna, [] as number[], 20);
    expect(r).toEqual({ dato: [], fallo: true });
    expect(reportados, "sin el nombre, el cuelgue se diagnostica a ciegas").toEqual(["carga.pagos.ventas-por-revisar"]);
  });

  it("un error tambien cae al respaldo, no tumba la pantalla", async () => {
    reportados.length = 0;
    const rota = async () => {
      throw new Error("sin conexión");
    };
    const r = await conLimite("pagos.pendientes-de-accion", rota, [] as number[], 50);
    expect(r.fallo).toBe(true);
    expect(reportados).toEqual(["carga.pagos.pendientes-de-accion"]);
  });

  it("CONTROL: la carga rapida no deja un temporizador vivo esperando su limite", async () => {
    vi.useFakeTimers();
    try {
      const promesa = conLimite("prueba.temporizador", async () => "ok", "", 60_000);
      await vi.advanceTimersByTimeAsync(0);
      await promesa;
      expect(vi.getTimerCount(), "el temporizador mantiene viva la funcion hasta que vence").toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
