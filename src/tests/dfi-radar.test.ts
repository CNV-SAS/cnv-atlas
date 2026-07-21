import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DfiDomain } from "@/clinical-engine";
import { DfiRadar } from "@/modules/diagnoses/components/dfi-radar";

// Smoke de render del radar DFI: rinde los 5 dominios del snapshot, con un vertice por dominio y
// el color del poligono siguiendo la severidad integrada (paleta clinica BRAND). Los datos son
// del snapshot inmutable (computeDFI congelado); aqui solo probamos la presentacion.

const DOMAINS: DfiDomain[] = [
  { id: "d1", nombre: "Celular-Electrico", sev: 0, clasif: "c1", lectura: "l1", items: [] },
  { id: "d2", nombre: "Metabolico-Estructural", sev: 1, clasif: "c2", lectura: "l2", items: [] },
  { id: "d3", nombre: "Envejecimiento", sev: 2, clasif: "c3", lectura: "l3", items: [] },
  { id: "d4", nombre: "Conductual-Perceptual", sev: 3, clasif: "c4", lectura: "l4", items: [] },
  { id: "d5", nombre: "Epigenetico-Contextual", sev: 1, clasif: "c5", lectura: "l5", items: [] },
];

function render(riskSev: number): string {
  return renderToStaticMarkup(createElement(DfiRadar, { domains: DOMAINS, riskSev }));
}

describe("DfiRadar", () => {
  it("rinde un poligono de datos con un vertice por dominio (5)", () => {
    const markup = render(2);
    // El poligono de datos tiene la clase de color de riesgo; los anillos guia son fill none.
    const dataPoly = markup.match(/<polygon points="([^"]+)"[^>]*fill-clinical/);
    expect(dataPoly).not.toBeNull();
    const pts = (dataPoly?.[1] ?? "").trim().split(/\s+/);
    expect(pts.length).toBe(5);
  });

  it("rotula los 5 ejes con los nombres cortos fieles del HTML (por id, no por d.nombre)", () => {
    const markup = render(1);
    // Nombres cortos EXACTOS del HTML de referencia (_RAD_SHORT), resueltos por id. El fixture
    // trae los nombres largos del snapshot ("Metabolico-Estructural"); si el radar los usara, el
    // texto no coincidiria: esto prueba que rotula por id.
    const SHORT: Record<string, string> = {
      d1: "Celular",
      d2: "Metabólico",
      d3: "Enveje.",
      d4: "Conductual",
      d5: "Epigenét.",
    };
    for (const d of DOMAINS) expect(markup).toContain(SHORT[d.id]);
    // Zona por eje presente como texto (vocabulario del HTML), no solo color: sev 0 -> "Muy bien",
    // sev 3 -> "A tratar".
    expect(markup).toContain("Muy bien");
    expect(markup).toContain("A tratar");
  });

  it("incluye la leyenda de zonas y la frase del poligono, fieles al HTML", () => {
    const markup = render(1);
    for (const z of ["Excepcional", "Muy bien", "En la norma", "A vigilar", "A tratar"]) {
      expect(markup).toContain(z);
    }
    expect(markup).toContain("A menor polígono, mejor estado.");
  });

  it("el color del poligono sigue la severidad integrada", () => {
    expect(render(0)).toContain("fill-clinical-optimal");
    expect(render(2)).toContain("fill-clinical-warning");
    expect(render(3)).toContain("fill-clinical-critical");
  });
});
