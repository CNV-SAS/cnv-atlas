import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { enTandas } from "@/lib/observability/con-limite";

// ═══ NO PEDIR MAS DE LO QUE EL POOL PUEDE DAR (2026-09-24) ═══
//
// El pool de la base tiene SEIS conexiones. /pagos disparaba siete consultas a la vez, así que una se quedaba
// esperando turno, y el límite de `conLimite` corre MIENTRAS ESPERA: la que no alcanzó cupo se reportó como
// "no respondió en 8000 ms" sin haber llegado a correr. Medida sola tardaba 0,2 ms.
//
// Pasó dos veces (`dias-con-ventas-sin-cerrar` y después `devueltas`), y la segunda arrastró además a
// `pendientes-de-accion`, que falló por conexión. La primera vez agrupé consultas para que fueran menos, y no
// bastó: el arreglo no era pedir menos, era dejar de pedirlas TODAS A LA VEZ.
//
// Lo que este candado fija es lo único que de verdad importa aquí: que nunca haya más de N corriendo, y que
// una carga no empiece (ni su reloj) hasta que le toque.

describe("las cargas corren de a pocas", () => {
  it("nunca hay más de N a la vez", async () => {
    let vivas = 0;
    let maximo = 0;
    const carga = (ms: number) => async () => {
      vivas++;
      maximo = Math.max(maximo, vivas);
      await new Promise((r) => setTimeout(r, ms));
      vivas--;
      return ms;
    };
    await enTandas([carga(5), carga(1), carga(3), carga(2), carga(4), carga(1), carga(2)], 3);
    expect(maximo).toBe(3);
  });

  it("devuelve los resultados EN ORDEN, no en el que terminaron", async () => {
    const carga = (ms: number, valor: string) => async () => {
      await new Promise((r) => setTimeout(r, ms));
      return valor;
    };
    // La primera es la más lenta: si el orden dependiera de cuál termina antes, saldría al final.
    const r = await enTandas([carga(20, "a"), carga(1, "b"), carga(1, "c")], 2);
    expect(r).toEqual(["a", "b", "c"]);
  });

  it("una carga NO empieza hasta que le toca (su reloj tampoco)", async () => {
    // Es el punto entero: `conLimite` recibe una FUNCIÓN, así que su temporizador arranca cuando la consulta
    // arranca de verdad. Si recibiera una promesa ya lanzada, el reloj correría durante la espera.
    const arranques: number[] = [];
    const inicio = Date.now();
    const carga = () => async () => {
      arranques.push(Date.now() - inicio);
      await new Promise((r) => setTimeout(r, 30));
    };
    await enTandas([carga(), carga(), carga(), carga()], 2);
    expect(arranques.length).toBe(4);
    // Las dos últimas arrancaron DESPUÉS, no al principio junto con las otras.
    expect(arranques[3]).toBeGreaterThanOrEqual(20);
  });

  it("con menos cargas que el límite no se queda esperando a nadie", async () => {
    const r = await enTandas([async () => 1, async () => 2], 5);
    expect(r).toEqual([1, 2]);
  });
});
