import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { analizarDFI } from "@/clinical-engine/analysis";
import * as dfi from "@/clinical-engine/frozen/engine.dfi.authorized.js";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import encuesta from "./fixtures/clinical-engine/encuesta-sintetica.json";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL SIGNO DE LA DESVIACION DE φ EN EL CHIP DEL PABU (cotejo 2026-09-05, punto 9).
//
// EL DEFECTO. `computeDFIFromData` hace `num("ICA_BIS","icaBis") || (pabu ? pabu - 1.618 : null)`: si el
// dato no viene en la fila, lo RECALCULA CON SIGNO. Nuestra fila no lo traia, asi que en un paciente por
// DEBAJO de φ el chip decia "-0,42" mientras la fila ICA-BIS de la tabla, que sale de
// `indicators.icaBis`, decia "0,42". Dos fuentes del mismo dato en la MISMA pantalla, con signos
// distintos. En la pantalla de Gildardo la fila si lleva el dato y su chip dice "+0,42".
//
// POR QUE EL GOLDEN NO LO VEIA, que es la parte que importa: su donante tiene PABU 1,9925, o sea POR
// ENCIMA de φ, y ahi el valor con signo y el absoluto COINCIDEN. Un golden solo prueba los casos que su
// donante recorre. Por eso este candado usa un paciente por DEBAJO, que es donde los dos difieren.

const PHI = 1.618;

// Fila BIS minima: lo unico que decide este chip es el PABU (y el ICA_BIS si viene).
function fila(pabu: number, icaBis?: number): Record<string, unknown> {
  const f: Record<string, unknown> = { Re: 600, Ri: 1300, Rinf: 420, C: 3, PABU: pabu, IFC: 6, IRC: 1.6 };
  if (icaBis !== undefined) f.ICA_BIS = icaBis;
  return f;
}

function chipPabu(bis: Record<string, unknown>): string {
  const out = dfi.computeDFIFromData({ sexo: "M", edad: 40 }, bis) as {
    domains: { id: string; items: string[] }[];
  };
  const d1 = out.domains.find((d) => d.id === "d1");
  const chip = d1?.items.find((i) => i.startsWith("PABU"));
  expect(chip, "el chip del PABU").toBeDefined();
  return chip!;
}

describe("la desviación de φ del chip del PABU (cotejo punto 9)", () => {
  it("POR DEBAJO de φ y SIN el dato en la fila, el frozen la recalcula CON SIGNO", () => {
    // Esto es el defecto, dejado por escrito: es el comportamiento de su codigo cuando no se le da el
    // insumo. Si algun dia deja de ser asi, este caso avisa de que su reserva cambio.
    expect(chipPabu(fila(1.2))).toContain("-0,42");
  });

  it("con el dato en la fila (que es lo que hace Atlas), la magnitud manda: +0,42", () => {
    expect(chipPabu(fila(1.2, Math.abs(1.2 - PHI)))).toContain("+0,42");
  });

  it("POR ENCIMA de φ los dos caminos coinciden: ahi el golden no puede ver nada", () => {
    // El control que explica el agujero. Con el donante golden (PABU 1,9925) el defecto es invisible.
    expect(chipPabu(fila(1.9925))).toContain("+0,37");
    expect(chipPabu(fila(1.9925, Math.abs(1.9925 - PHI)))).toContain("+0,37");
  });

  it("y la DIRECCION sigue viniendo de la etiqueta, no del signo del numero", () => {
    // La regla de Gildardo: cPABU dice hacia donde, el ICA-BIS dice cuanto. Por debajo de φ la etiqueta
    // es "por exceso" (exceso de adiposidad) aunque la magnitud sea positiva.
    const c = chipPabu(fila(1.2, Math.abs(1.2 - PHI)));
    expect(c).toContain("Desviación por exceso");
    expect(chipPabu(fila(1.9925, Math.abs(1.9925 - PHI)))).toContain("Desviación por déficit");
  });

  it("UNA SOLA FUENTE: `analizarDFI` le ENTREGA el ICA_BIS a la fila, en vez de dejar que lo recalcule", () => {
    // ASERCION SOBRE EL SITIO DE LLAMADA, y a proposito: el defecto era una OMISION (nadie llenaba el
    // campo), asi que probar que el frozen se porta bien cuando SI se lo dan no cubre el hueco. Los dos
    // casos de laboratorio de arriba ya prueban las dos ramas del frozen; lo que falta probar es que
    // Atlas toma la rama buena.
    //
    // Y no se puede probar corriendo la cadena con el donante golden: su PABU es 1,9925, por ENCIMA de
    // φ, donde el valor con signo y el absoluto COINCIDEN. Es el mismo agujero que dejo pasar el
    // defecto.
    const src = sinComentarios(readFileSync("src/clinical-engine/analysis.ts", "utf8"));
    expect(src, "la fila que va al DFI tiene que llevar el ICA_BIS").toContain("ICA_BIS: Math.abs(PABU - 1.618)");
  });

  it("y con el donante golden la cadena real sigue citando la magnitud", () => {
    // Coherencia de punta a punta sobre el camino real. No discrimina el signo (ese donante esta por
    // encima de φ), pero si detecta que el chip deje de citar el ICA-BIS o cambie de formato.
    const out = analizarDFI(biody as Record<string, unknown>, {
      ...(encuesta as Record<string, unknown>),
      sexo: "M",
      edad: 54,
    });
    const chip = out.domains.find((d) => d.id === "d1")?.items.find((i) => i.startsWith("PABU"));
    expect(chip).toBeDefined();
    const magnitud = Math.abs(1.9925 - PHI).toFixed(2).replace(".", ",");
    expect(chip).toContain(`+${magnitud}`);
  });
});
