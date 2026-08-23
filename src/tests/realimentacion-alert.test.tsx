import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RealimentacionAlert } from "@/modules/treatment/components/realimentacion-alert";

// Aviso de SEGURIDAD del sindrome de realimentacion (hueco clinico cerrado 2026-08-22): el motor lo computa
// (golden protocolo-motor caso 14: F10 + imc 17 + geb 1100 -> alertaSindRealim=true), el reader pasa el snapshot
// completo (protocolSuggested) y el panel/resumen renderizan ESTE aviso cuando el flag es true. Aqui se bloquean
// las dos garantias que un edit futuro no debe romper (cuidados de Santiago): que se vea como CRITICO (no un
// aviso mas) y que NO se pueda descartar. Un aviso de seguridad que se degrada o se cierra deja de proteger.

function render(children: string): string {
  return renderToStaticMarkup(createElement(RealimentacionAlert, null, children));
}

describe("RealimentacionAlert (aviso de seguridad, no descartable)", () => {
  const markup = render("Riesgo de síndrome de realimentación. Inicia con 10 kcal/kg/día (ASPEN 2023).");

  it("muestra el texto de seguridad que se le pasa", () => {
    expect(markup).toContain("Riesgo de síndrome de realimentación");
    expect(markup).toContain("10 kcal/kg/día");
  });

  it("se distingue como CRITICO, no como un aviso ambar mas (borde grueso + token critico + etiqueta)", () => {
    expect(markup).toContain("border-clinical-critical");
    expect(markup).toContain("border-2");
    expect(markup).toContain("text-clinical-critical");
    expect(markup).toContain("Seguridad del paciente");
    // NO usa el token ambar de los avisos normales del plan (desfase/descuadre/sin porciones).
    expect(markup).not.toContain("clinical-warning");
  });

  it("NO es descartable: no renderiza ningun boton de cierre ni control interactivo", () => {
    expect(markup).not.toContain("<button");
    expect(markup.toLowerCase()).not.toContain("cerrar");
    expect(markup.toLowerCase()).not.toContain("descartar");
    expect(markup).not.toContain("aria-label=\"Cerrar\"");
  });

  it("se anuncia como alerta a lectores de pantalla (role=alert)", () => {
    expect(markup).toContain('role="alert"');
  });
});
