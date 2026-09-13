import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { saldoPorProducto } from "@/modules/nutraceuticals/saldo-por-producto";

// ═══ EL SALDO DE UN PRODUCTO SUMA TODOS SUS LOTES ═══
//
// Dormido desde la 0121: el saldo es por (ubicacion, producto, lote), y tres lectores leian una fila por
// producto. Con dos lotes, "Mi inventario" mostraba solo el ultimo y la entrega avisaba de un negativo que
// no existia. Despierta con la primera remesa de un lote nuevo; arreglarlo dormido cuesta poco, y
// despierto cuesta un conteo fisico.

vi.mock("server-only", () => ({}));

describe("la suma, sin base", () => {
  it("dos lotes del mismo producto se suman", () => {
    const s = saldoPorProducto([
      { nutraceutical_id: "a", stock_quantity: 30 },
      { nutraceutical_id: "a", stock_quantity: 5 },
      { nutraceutical_id: "b", stock_quantity: 12 },
    ]);
    expect(s.get("a")).toBe(35);
    expect(s.get("b")).toBe(12);
  });

  it("el orden de los lotes no cambia el resultado (el defecto dependia de cual llegaba ultimo)", () => {
    const filas = [
      { nutraceutical_id: "a", stock_quantity: 5 },
      { nutraceutical_id: "a", stock_quantity: 30 },
    ];
    expect(saldoPorProducto(filas).get("a")).toBe(saldoPorProducto([...filas].reverse()).get("a"));
  });

  it("un lote en negativo resta, no se ignora", () => {
    expect(
      saldoPorProducto([
        { nutraceutical_id: "a", stock_quantity: 10 },
        { nutraceutical_id: "a", stock_quantity: -2 },
      ]).get("a"),
    ).toBe(8);
  });
});

describe("los tres lectores usan la suma (el defecto era una OMISION en cada sitio)", () => {
  const src = readFileSync("src/modules/nutraceuticals/services/inventory-service.ts", "utf8");
  const cuerpo = (nombre: string) => {
    const desde = src.indexOf(`export async function ${nombre}(`);
    const hasta = src.indexOf("\nexport async function ", desde + 1);
    return src.slice(desde, hasta === -1 ? undefined : hasta);
  };

  it.each(["getOwnInventory", "getOwnStockByIds", "recordDespacho"])("%s suma por lote", (nombre) => {
    expect(cuerpo(nombre)).toContain("saldoPorProducto(");
  });

  it("y ninguno relee el saldo con maybeSingle, que falla con dos lotes", () => {
    for (const nombre of ["getOwnInventory", "getOwnStockByIds", "recordDespacho"]) {
      const c = cuerpo(nombre);
      const lecturaDeSaldo = c.slice(c.lastIndexOf('from("nutraceutical_inventory")'));
      expect(lecturaDeSaldo, nombre).not.toContain("maybeSingle");
    }
  });
});

