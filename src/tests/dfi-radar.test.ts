import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DfiDomain } from "@/clinical-engine";
import { DfiRadar } from "@/modules/diagnoses/components/dfi-radar";

// Smoke de render del radar DFI (replica radar-antiguo.png, 2026-08-15): anillos SOLIDOS de la escala
// (azul/verde/amarillo/rojo, el azul se conserva porque aqui es ESCALA, no clasificacion) + poligono del
// paciente en linea OSCURA con puntos (no coloreado por el riesgo integrado). Datos del snapshot congelado.

const DOMAINS: DfiDomain[] = [
  { id: "d1", nombre: "Celular-Electrico", sev: 0, clasif: "c1", lectura: "l1", items: [] },
  { id: "d2", nombre: "Metabolico-Estructural", sev: 1, clasif: "c2", lectura: "l2", items: [] },
  { id: "d3", nombre: "Envejecimiento", sev: 2, clasif: "c3", lectura: "l3", items: [] },
  { id: "d4", nombre: "Conductual-Perceptual", sev: 3, clasif: "c4", lectura: "l4", items: [] },
  { id: "d5", nombre: "Epigenetico-Contextual", sev: 1, clasif: "c5", lectura: "l5", items: [] },
];

function render(): string {
  return renderToStaticMarkup(createElement(DfiRadar, { domains: DOMAINS }));
}

describe("DfiRadar", () => {
  it("rinde el poligono del paciente con un vertice por dominio (5)", () => {
    const markup = render();
    // El poligono del paciente es el de linea OSCURA (fill-foreground); los anillos usan fill-clinical-*.
    const dataPoly = markup.match(/<polygon points="([^"]+)"[^>]*fill-foreground/);
    expect(dataPoly).not.toBeNull();
    const pts = (dataPoly?.[1] ?? "").trim().split(/\s+/);
    expect(pts.length).toBe(5);
  });

  it("rotula los 5 ejes con los nombres cortos fieles del HTML (por id, no por d.nombre)", () => {
    const markup = render();
    const SHORT: Record<string, string> = {
      d1: "Celular",
      d2: "Metabólico",
      d3: "Enveje.",
      d4: "Conductual",
      d5: "Epigenét.",
    };
    for (const d of DOMAINS) expect(markup).toContain(SHORT[d.id]);
    expect(markup).toContain("Bajo");
    expect(markup).toContain("Alto");
  });

  it("incluye la leyenda de severidad del motor y la frase del poligono", () => {
    const markup = render();
    for (const z of ["Bajo", "Leve", "Moderado", "Alto"]) {
      expect(markup).toContain(z);
    }
    expect(markup).toContain("A menor polígono, mejor estado.");
  });

  it("anillos SOLIDOS de la escala (azul se conserva) + poligono oscuro, no coloreado por riesgo", () => {
    const markup = render();
    // Anillos: la escala del radar, solidos (fill-clinical-*, NO el fill claro -bg de antes).
    for (const c of [
      "fill-clinical-excellent",
      "fill-clinical-optimal",
      "fill-clinical-warning",
      "fill-clinical-critical",
    ]) {
      expect(markup).toContain(c);
    }
    expect(markup).not.toContain("fill-clinical-excellent-bg"); // ya no son fondos claros
    // El poligono del paciente es oscuro (foreground) y NO lleva stroke de color de riesgo.
    expect(markup).toContain("stroke-foreground");
    expect(markup).not.toContain("stroke-clinical");
  });
});
