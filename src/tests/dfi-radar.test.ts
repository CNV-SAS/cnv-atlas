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

  it("rotula los 5 ejes con el nombre COMPLETO del dominio, sin abreviar", () => {
    // ALCANCE AJUSTADO (2026-09-09), no la asercion. Este caso fijaba los nombres CORTOS de su `_RAD_SHORT`
    // ("Enveje.", "Epigenét.") y se puso rojo por la lista copiada: Santiago pidio los completos ahora que
    // el radar es grande, y los completos son tambien suyos (salen del motor congelado, en `d.nombre`).
    //
    // Lo que el caso GARANTIZA sigue siendo lo mismo y es lo que dice su titulo: que los cinco ejes se
    // rotulan, y desde los datos del dominio. Ahora ademas prohibe la abreviatura, que es lo que se vino a
    // quitar. Se comprueba por PARTES porque los nombres con guion se parten en dos lineas.
    const markup = render();
    for (const d of DOMAINS) {
      for (const parte of d.nombre.split("-")) {
        expect(markup, `falta el rótulo del eje ${d.id}`).toContain(parte);
      }
    }
    expect(markup, "quedó una abreviatura en los rótulos de los ejes").not.toMatch(
      /[a-zé]\.<\/tspan>/,
    );
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
