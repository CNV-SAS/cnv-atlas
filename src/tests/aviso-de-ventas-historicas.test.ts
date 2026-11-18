import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  VENTAS_HISTORICAS_CARGADAS,
  avisoDeVentasHistoricas,
} from "@/modules/nutraceuticals/carga-de-ventas-historicas";

// ═══ EL INVENTARIO DICE MAS QUE EL FISICO, Y LAS TRES PANTALLAS LO DICEN IGUAL ═══
//
// Contabilidad acepto el 2026-11-18 que el inventario quede inflado HASTA EL 30 DE NOVIEMBRE, con una
// condicion: que la pantalla lo diga. Este candado es esa condicion.
//
// LO QUE VIGILA NO ES LA FRASE, ES QUE NO HAYA TRES. La vez anterior cuatro pantallas afirmaron, cada una
// por su cuenta, un arranque que no habia ocurrido, y la causa no fue que una estuviera mal escrita: fue
// que cada una escribia la suya. Por eso se comprueba que las tres LLAMEN al modulo, no que contengan un
// texto.

const archivo = (p: string) => readFileSync(p, "utf8");

describe("el aviso de la carga de ventas históricas", () => {
  it("mientras no se carguen, dice que el sistema muestra MÁS de lo que hay", () => {
    const aviso = avisoDeVentasHistoricas(false);
    expect(aviso).not.toBeNull();
    // Las dos mitades que tiene que llevar: qué pasa, y que es a propósito. Sin la segunda se lee como un
    // defecto, que es justo lo que el aviso existe para evitar.
    expect(aviso).toMatch(/más unidades de las que hay/i);
    expect(aviso).toMatch(/a propósito/i);
  });

  it("y cuando se carguen, desaparece solo: no hay que acordarse de quitarlo de tres sitios", () => {
    expect(avisoDeVentasHistoricas(true)).toBeNull();
  });

  it("hoy sigue sin cargarse, y el día que cambie este candado obliga a mirar las tres pantallas", () => {
    // NO ES UN CANDADO DEL VALOR, es un recordatorio con dirección: el día que alguien ponga la constante en
    // `true` este caso falla, y lo que hay que hacer es borrar el aviso de las tres pantallas y este caso.
    expect(VENTAS_HISTORICAS_CARGADAS).toBe(false);
  });

  it("las tres pantallas de inventario lo sacan del módulo, no de su propio texto", () => {
    for (const p of [
      "src/app/(app)/mi-inventario/page.tsx",
      "src/app/(app)/faltantes/page.tsx",
      "src/app/(app)/direccion/page.tsx",
    ]) {
      expect(archivo(p), `${p} no llama a avisoDeVentasHistoricas`).toMatch(/avisoDeVentasHistoricas\(/);
    }
  });
});
