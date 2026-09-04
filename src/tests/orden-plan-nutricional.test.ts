import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL ORDEN DE LA PANTALLA DEL NUTRICIONISTA (2026-08-24). Se adopta el orden de Gildardo
// (objetivo → validación → fórmula → intercambio → distribución → menú) con DOS divergencias deliberadas.
// Lo que se blinda es que un reorden futuro no las pierda por descuido, y que ninguna sección pierda su
// firma al moverse (el reorden anterior de este panel dejo secciones pegadas por eso).
//
// LO QUE ESTE CANDADO **NO** VERIFICA, y va dicho para que nadie lo lea como una garantía que no da
// (anotado el 2026-09-04, barriendo los candados que afirman una relación con un artefacto que no abren):
// **no abre el archivo de Gildardo**. Lee solo nuestro panel. Así que cuando un caso dice "como en su
// pantalla" o "DIVERGENCIA: él los pone después", está fijando NUESTRO orden y repitiendo lo que su
// archivo decía el 2026-08-24; si él reordena su panel, aquí no se pone nada rojo y la divergencia
// declarada puede haber dejado de serlo.
//
// NO SE CIERRA HOY, y la razón es de proporción: esto es el orden de la pantalla de trabajo del
// profesional, no contenido clínico ni nada que llegue a un paciente, y extraer el orden de secciones de
// su HTML es un porte en sí mismo. Se deja anotado y va al backlog. El caso que sí importaba de esta
// familia (el lenguaje de paciente de `dfi-paciente`) sí se cerró, porque ese sí viaja en un documento.

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
    // "guias" salió de la lista el 2026-08-31: la sección se RETIRÓ (cotejo, punto g). Eran nuestras, su
    // archivo no tiene una lista de guías, y decían con otras palabras lo que ya dice el objetivo más los
    // atributos del motor. Va declarado en la ronda porque él aprobó la caja el 26 ("la caja se queda").
    // El servicio, la acción y la tabla NO se tocaron: devolverla es volver a montar un componente.
    for (const sec of [
      "objetivo",
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
