import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { brutoReconocido } from "@/modules/payments/cobro-reconocido";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL BRUTO Y DEL INVENTARIO: LAS DOS PANTALLAS DICEN LO MISMO (smoke del 2026-09-29).
//
// LOS DOS DEFECTOS QUE CIERRA, y los dos son la misma forma: una regla aplicada en una pantalla y no en la
// otra, sobre el mismo hecho.
//
//   1. LA VENTA DEVUELTA SEGUIA EN EL BRUTO. El descuento del 2026-09-17 cubria la DISPUTA PERDIDA; la
//      devolucion del paciente se construyo despues (2026-09-22), con otro estado, y se quedo fuera. Inicio
//      decia 3.256.900 y el profesional 3.166.900: los 90.000 de una LUVIA que habia vuelto.
//   2. EL INVENTARIO CONTABA LOS PRODUCTOS DE PRUEBA en Inicio y no en Direccion: 1.903 contra 1.820.
//
// Es lo mismo que ya paso con "45 referencias". Por eso la cuenta vive en UN modulo neutro y este candado
// comprueba que las dos pantallas lo usen: un comentario en un lector no alcanza al otro.

describe("el bruto reconocido", () => {
  const venta = (id: string, amount: number) => ({ id, amount: String(amount) });

  it("suma lo pagado cuando no hay nada que descontar", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 100_000), venta("b", 50_000)],
        disputasPerdidas: [],
        devoluciones: [],
      }),
    ).toBe(150_000);
  });

  // LA DISPUTA PERDIDA RESTA LA VENTA ENTERA: el banco devolvio todo.
  it("una disputa perdida saca la venta completa", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 100_000), venta("b", 50_000)],
        disputasPerdidas: ["a"],
        devoluciones: [],
      }),
    ).toBe(50_000);
  });

  // LA DEVOLUCION RESTA LO DEVUELTO, NO LA VENTA: quien devolvio una de cuatro sigue habiendo comprado tres.
  // Restar la venta entera seria el error en el otro sentido, y es el que mas se parece a lo correcto.
  it("una devolucion parcial resta solo lo devuelto", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 360_000)],
        disputasPerdidas: [],
        devoluciones: [90_000],
      }),
    ).toBe(270_000);
  });

  // EL CASO DEL SMOKE, con sus cifras.
  it("reproduce el caso del smoke: la LUVIA devuelta sale del bruto", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("todas", 3_256_900)],
        disputasPerdidas: [],
        devoluciones: [90_000],
      }),
    ).toBe(3_166_900);
  });

  it("aguanta cifras nulas sin inventar un numero", () => {
    expect(
      brutoReconocido({
        pagadas: [{ id: "a", amount: null }],
        disputasPerdidas: [],
        devoluciones: [null],
      }),
    ).toBe(0);
  });
});

describe("las dos pantallas usan la misma cuenta", () => {
  const INICIO = sinComentarios(readFileSync("src/modules/dashboard/data/tablero-reader.ts", "utf8"));
  const DIRECCION = sinComentarios(readFileSync("src/modules/direccion/data/dashboard-reader.ts", "utf8"));

  it("las dos llaman a brutoReconocido, y ninguna suma por su cuenta", () => {
    expect(INICIO).toContain("brutoReconocido");
    expect(DIRECCION).toContain("brutoReconocido");
  });

  it("las dos descuentan las devoluciones", () => {
    expect(INICIO).toContain("ESTADO_DEVUELTA");
    expect(DIRECCION).toContain("ESTADO_DEVUELTA");
  });

  it("y las dos excluyen los productos de prueba del inventario", () => {
    expect(INICIO).toContain("EMBED_PRODUCTO_NO_DE_PRUEBA");
    expect(DIRECCION).toContain("EMBED_PRODUCTO_NO_DE_PRUEBA");
  });
});
