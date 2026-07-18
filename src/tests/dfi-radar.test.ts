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

  it("muestra los 5 nombres de dominio y su severidad en texto (accesible)", () => {
    const markup = render(1);
    for (const d of DOMAINS) expect(markup).toContain(d.nombre.split("-")[0]);
    // Severidades presentes como texto, no solo color.
    expect(markup).toContain("Optimo");
    expect(markup).toContain("Alto");
  });

  it("el color del poligono sigue la severidad integrada", () => {
    expect(render(0)).toContain("fill-clinical-optimal");
    expect(render(2)).toContain("fill-clinical-warning");
    expect(render(3)).toContain("fill-clinical-critical");
  });
});
