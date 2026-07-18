import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { efrStateNumber } from "@/clinical-engine";
import { Diana } from "@/modules/diagnoses/components/diana";

// Smoke DINAMICO de la Diana EFR: la celda resaltada debe seguir al estado REAL del paciente
// (derivado de las bandas), no a un numero fijo. Renderiza el componente a markup estatico y
// verifica que la posicion del resalte cambia con las bandas y que el gradiente de riesgo esta
// presente. La numeracion en si la valida efr-state-numbering.test.ts; aqui probamos el render.

function render(bands: { ifc: number; irc: number; ffmi: number; fmi: number }): string {
  return renderToStaticMarkup(
    createElement(Diana, {
      bands,
      stateNumber: efrStateNumber(bands),
      frSectorName: "sector-x",
      structuralName: "anillo-y",
    }),
  );
}

// d del path resaltado (contorno de la celda del paciente: el unico con stroke-foreground).
function highlightPath(markup: string): string {
  const tag = markup.match(/<path\b[^>]*stroke-foreground[^>]*>/);
  const d = tag?.[0].match(/\bd="([^"]+)"/);
  return d ? d[1] : "";
}

describe("Diana EFR: placement dinamico", () => {
  it("pinta las 81 celdas con el gradiente de riesgo", () => {
    const markup = render({ ifc: 2, irc: 2, ffmi: 2, fmi: 2 }); // N/N/N/N (#31)
    const fills = markup.match(/fill="rgb\(/g) ?? [];
    expect(fills.length).toBe(81);
    // Verde (bajo riesgo, centro) y rojo oscuro (alto, exterior) presentes: hay gradiente real.
    expect(markup).toContain("rgb(34,197,94)");
    expect(markup).toContain("rgb(127,29,29)");
  });

  it("resalta exactamente una celda y muestra su numero de estado", () => {
    const bands = { ifc: 2, irc: 2, ffmi: 2, fmi: 3 }; // N/N/N/A -> #33 (caso golden)
    const markup = render(bands);
    const highlights = markup.match(/stroke-foreground/g) ?? [];
    expect(highlights.length).toBe(1);
    expect(efrStateNumber(bands)).toBe(33);
    // El numero aparece en el marcador (no depende del color para leer la posicion).
    expect(markup).toContain(">33</text>");
  });

  it("mueve el resalte cuando cambia el estado del paciente (dinamico, no fijo)", () => {
    const centro = render({ ifc: 3, irc: 1, ffmi: 3, fmi: 1 }); // #1, mejor, al centro
    const medio = render({ ifc: 2, irc: 2, ffmi: 2, fmi: 3 }); // #33
    const peor = render({ ifc: 1, irc: 3, ffmi: 1, fmi: 3 }); // #81, peor, periferia

    const d1 = highlightPath(centro);
    const d33 = highlightPath(medio);
    const d81 = highlightPath(peor);

    expect(d1).not.toBe("");
    // Tres estados distintos -> tres celdas distintas: la posicion sigue al estado real.
    expect(new Set([d1, d33, d81]).size).toBe(3);
  });
});
