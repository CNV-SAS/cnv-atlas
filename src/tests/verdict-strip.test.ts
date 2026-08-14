import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VerdictStrip } from "@/modules/diagnoses/components/verdict-strip";

// Franja de veredicto: la conclusion persistente del Diagnostico. No puede perder informacion (estado
// EFR + riesgo + ruta) ni mostrar el nivel concreto cuando el DFI esta incompleto.

function render(props: Parameters<typeof VerdictStrip>[0]): string {
  return renderToStaticMarkup(createElement(VerdictStrip, props));
}

describe("VerdictStrip", () => {
  it("muestra estado EFR, riesgo integrado y ruta prioritaria", () => {
    const markup = render({
      stateNumber: 1,
      efrName: "Estado celular ideal",
      riskLevel: "ALTO",
      riskScore: 20,
      dfiComplete: true,
      rutaPrioritaria: "Ruta 4 · Desaceleración Envejecimiento",
    });
    expect(markup).toContain("1 de 81");
    expect(markup).toContain("Estado celular ideal");
    expect(markup).toContain("ALTO");
    expect(markup).toContain("20");
    expect(markup).toContain("Ruta 4 · Desaceleración Envejecimiento");
    expect(markup).toContain("ver en Tratamiento");
  });

  it("con el DFI incompleto muestra 'Provisional', no el nivel concreto", () => {
    const markup = render({
      stateNumber: 5,
      efrName: null,
      riskLevel: "ALTO",
      riskScore: 20,
      dfiComplete: false,
      rutaPrioritaria: null,
    });
    expect(markup).toContain("Provisional");
    expect(markup).not.toContain("ALTO");
  });
});
