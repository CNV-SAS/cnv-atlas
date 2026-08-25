import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL ORDEN DE LA PANTALLA DEL NUTRICIONISTA (2026-08-24). Se adopta el orden de Gildardo
// (objetivo → validación → fórmula → intercambio → distribución → menú) con DOS divergencias deliberadas.
// Lo que se blinda es que un reorden futuro no las pierda por descuido, y que ninguna sección pierda su
// firma al moverse (el reorden anterior de este panel dejo secciones pegadas por eso).

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const pos = (t: string) => {
  const i = PANEL.indexOf(t);
  expect(i, `no se encontró ${t}`).toBeGreaterThan(-1);
  return i;
};

describe("orden del plan alimentario", () => {
  it("la validación va ANTES de la fórmula, como en su pantalla", () => {
    expect(pos("<ValidacionSection")).toBeLessThan(pos("<CadenaCaloricaSection"));
  });

  it("y después del objetivo: primero se fija la meta", () => {
    expect(pos("<ObjetivoSection")).toBeLessThan(pos("<ValidacionSection"));
  });

  it("la cadena va antes del intercambio, que consume su objetivo", () => {
    expect(pos("<CadenaCaloricaSection")).toBeLessThan(pos("<IntercambioSection"));
  });

  it("DIVERGENCIA: los tiempos activos van ANTES de la distribución (él los pone después)", () => {
    // Gobiernan el reparto: ponerlos después obliga a subir a corregir.
    expect(pos("<TiemposActivosSection")).toBeLessThan(pos("<TiemposSection"));
  });

  it("el menú va al final de la cadena, después de la distribución", () => {
    expect(pos("<TiemposSection")).toBeLessThan(pos("<MenuSemanalSection"));
  });

  it("DIVERGENCIA: la validación tiene ESTADO VACÍO (una tabla de ceros afirmaría algo falso)", () => {
    expect(PANEL).toContain("if (!algunaPorcion) {");
    expect(PANEL).toContain("Todavía no hay plan que validar");
  });

  it("ninguna sección con estado editable perdió su firma al reordenar", () => {
    // La validación es la única sin key, y es correcto: es derivada en vivo y de solo lectura.
    // Se compara sobre el texto con los espacios colapsados, porque varias llamadas son multilínea.
    const FLAT = PANEL.replace(/\s+/g, " ");
    for (const sec of [
      "objetivo",
      "guias",
      "cadena",
      "intercambio",
      "tiempos-activos",
      "tiempos",
      "menu-semanal",
    ]) {
      const ok =
        FLAT.includes('sectionKey("' + sec + '"') || FLAT.includes('sectionKey( "' + sec + '"');
      expect(ok, `la sección ${sec} perdió su sectionKey`).toBe(true);
    }
  });
});
