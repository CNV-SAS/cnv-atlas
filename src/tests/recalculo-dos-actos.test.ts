import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LOS DOS RECALCULOS (cotejo visual 2026-08-31, punto 6).
//
// LO QUE SE VERIFICO ANTES DE CONSTRUIR, y cambio el trabajo: los dos botones YA EXISTIAN, ya estaban
// separados y ya avisaban en la etiqueta. La pregunta de Santiago ("verifica que sean dos botones o uno:
// el reparto y la distribucion son dos actos, y el suyo los tiene separados") tenia respuesta en el
// codigo. Lo que faltaba era otra cosa: el aviso vivia SOLO en la etiqueta, y una etiqueta se lee DESPUES
// de hacer clic. Un acto destructivo a un clic de distancia, con la advertencia como unico freno.
//
// POR QUE SON DOS Y NO UNO: "recalcular desde el objetivo" rehace el REPARTO por alimento; "recalcular
// desde el intercambio" rehace la DISTRIBUCION por tiempos. Fundirlos obligaria a rehacer las dos cosas
// para corregir una, y el reparto es el trabajo caro.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("son DOS actos, con DOS botones", () => {
  it("existen los dos y dicen desde dónde recalculan", () => {
    expect(PANEL).toContain('etiqueta="Recalcular desde el objetivo"');
    expect(PANEL).toContain('etiqueta="Recalcular desde el intercambio"');
  });

  it("los dos pasan por el MISMO mecanismo de confirmación", () => {
    // Dos actos, un solo freno: si cada seccion escribiera el suyo, uno de los dos se quedaria sin el.
    expect((PANEL.match(/<BotonRecalcular/g) ?? []).length).toBe(2);
    expect(PANEL).toContain("function BotonRecalcular(");
  });
});

describe("el freno: se confirma solo cuando hay algo que perder", () => {
  it("sin ajustes manuales el botón actúa directo", () => {
    // Pedir confirmacion cuando no hay nada que borrar es la ceremonia que entrena a confirmar sin leer,
    // y entonces el dia que SI hay algo que perder tampoco se lee.
    expect(PANEL).toContain("if (!hayAjustes)");
  });

  it("con ajustes manuales pide confirmación, y dice qué se pierde", () => {
    expect(PANEL).toContain("Se pierden tus ajustes manuales.");
    expect(PANEL).toContain("Sí, recalcular");
    expect(PANEL).toContain("Cancelar");
  });

  it("cada sección sabe si tiene ajustes que perder, y cada una a su manera", () => {
    // El intercambio compara contra los DEFAULTS VIVOS (si el objetivo cambio, lo guardado tambien es
    // "ajuste" frente a lo que el recalculo va a poner); la distribucion, contra las celdas tocadas.
    expect(PANEL).toContain("const hayAjustesIntercambio = defaults.some(");
    expect(PANEL).toContain("hayAjustes={Object.keys(celdas).length > 0}");
  });

  it("los tres botones del paso de confirmación llevan `key` distintas", () => {
    // El hazard del wizard, que solo aparece en un navegador real: con la misma key React reutiliza el
    // nodo y el clic que PIDE confirmacion aterriza en el que CONFIRMA. Aqui los tres son type="button",
    // asi que no hay envio nativo, pero el remonte equivocado sigue siendo posible y el efecto seria
    // exactamente el que la confirmacion viene a impedir: borrar los ajustes de un solo clic.
    for (const k of ["recalcular-pedir", "recalcular-confirmar", "recalcular-cancelar"]) {
      expect(PANEL, `falta la key ${k}`).toContain(`key="${k}"`);
    }
  });
});
