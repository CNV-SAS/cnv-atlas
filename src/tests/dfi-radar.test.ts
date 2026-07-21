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
    // Severidad por eje como texto (vocabulario del MOTOR, ver V0-b), no solo color: sev 0 ->
    // "Óptimo", sev 3 -> "Alto".
    expect(markup).toContain("Óptimo");
    expect(markup).toContain("Alto");
  });

  it("incluye la leyenda de severidad del motor y la frase del poligono", () => {
    const markup = render(1);
    for (const z of ["Óptimo", "Leve", "Moderado", "Alto"]) {
      expect(markup).toContain(z);
    }
    expect(markup).toContain("A menor polígono, mejor estado.");
  });

  it("el color del poligono de datos sigue la severidad integrada", () => {
    // stroke-clinical-* solo lo lleva el poligono de datos; las zonas de fondo usan fill-*-bg.
    expect(render(0)).toContain("stroke-clinical-optimal");
    expect(render(2)).toContain("stroke-clinical-warning");
    expect(render(3)).toContain("stroke-clinical-critical");
    expect(render(0)).not.toContain("stroke-clinical-warning");
  });
});
