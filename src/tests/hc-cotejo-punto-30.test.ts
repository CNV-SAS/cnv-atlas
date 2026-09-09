import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildComposition } from "@/modules/diagnoses/data/composition-map";
import { HC_ANTECEDENTES } from "@/modules/reports/data/hc-antecedentes-map";
import { nivelFaLabel } from "@/modules/treatment/data/treatment-view-types";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADOS DEL PUNTO 30 DEL COTEJO: los tres arreglos que salieron del bloque por bloque de la pestaña
// Reporte/HC contra su archivo, y que no necesitaban decisión suya porque son porte o son defecto nuestro.
//
// Lo que SÍ necesita decisión (el orden de los bloques, las remisiones derivadas de las rutas, la
// referencia del % de grasa, los decimales del IMC y el PBI) queda fuera a propósito: un candado escrito
// sobre una pregunta abierta convierte la suposición en regla.

const PANTALLA = sinComentarios(
  readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8"),
);
const PDF = sinComentarios(readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8"));
const COMPOSITOR = sinComentarios(
  readFileSync("src/modules/reports/data/hc-composicion.ts", "utf8"),
);
const PANEL = sinComentarios(
  readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"),
);
const PANTALLA_PAGE = sinComentarios(
  readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"),
);

describe("la actividad física se registra con el nombre con el que se eligió", () => {
  it("el compositor usa el rótulo del nivel, no el factor crudo", () => {
    // Decía "PAL 1.375". Su historia clínica dice "FA ligera" y el panel donde el profesional lo ELIGE
    // dice "Ligera (1.375)". Un documento probatorio registra la decisión con las palabras con las que
    // se tomó.
    expect(COMPOSITOR).toContain("nivelFaLabel(efectivo.pal)");
    expect(COMPOSITOR, "el factor crudo ya no se imprime").not.toContain("`PAL ${efectivo.pal}`");
  });

  it("y la escala es UNA, compartida por el panel y el compositor", () => {
    // Dos listas de los mismos cinco niveles serían dos fuentes del mismo dato sin nada que las compare.
    expect(nivelFaLabel(1.375)).toBe("Ligera (1.375)");
    expect(nivelFaLabel(1.2)).toBe("Sedentario (1.2)");
    // Un factor fuera de su escala se muestra tal cual antes que inventarle un nombre.
    expect(nivelFaLabel(1.5)).toBe("1.5");
    expect(PANEL, "el panel ya no declara su propia copia").not.toContain("const NIVELES_FA = [");
    expect(PANEL).toContain("nivelFaLabel");
  });
});

describe('el sodio ausente dice "No aplica", no "No se registró"', () => {
  // El motor solo prescribe límite de sodio cuando hay condición que lo pida (HTA, ERC, alteración
  // hídrica), así que su ausencia no es un olvido. En un documento probatorio las dos frases dicen cosas
  // distintas sobre el profesional.
  it("en la pantalla", () => {
    expect(PANTALLA).toContain('const NO_APLICA = "No aplica"');
    expect(PANTALLA).toContain("plan.sodioMax == null ? NO_APLICA");
  });

  it("y en el PDF, con la MISMA condición: la fila ya no desaparece", () => {
    // Antes la pantalla ponía texto y el PDF omitía la fila entera: dos documentos del mismo acto
    // clínico diciendo cosas distintas.
    expect(PDF).toContain("hc.plan.sodioMax == null");
    expect(PDF).toContain('"No aplica"');
    expect(PDF, "la fila ya no es condicional").not.toContain("{hc.plan.sodioMax != null ? (");
  });
});

describe("los antecedentes cierran con alergias, como su archivo", () => {
  it("alergias e intolerancias es el ÚLTIMO grupo", () => {
    const titulos = HC_ANTECEDENTES.map((g) => g.titulo);
    // Control de la aserción: que los cinco grupos sigan estando, para que "es el último" signifique algo.
    expect(titulos).toEqual([
      "Diagnósticos personales",
      "Medicamentos actuales",
      "Antecedentes quirúrgicos",
      "Exposición a contaminantes",
      "Alergias e intolerancias",
    ]);
  });
});

describe("los bloques van en el orden de su historia clínica", () => {
  // Se afirma el ORDEN, que no tiene una cifra que aflojar cuando estorbe. Los dos movimientos son solo
  // mover: ninguno de estos bloques depende de otro, todos se computan antes del render.
  //
  //   · La COMPOSICIÓN va antes de los tres párrafos: el dato objetivo primero, su interpretación después.
  //   · Las RUTAS van justo después del objetivo y antes del plan: la ruta es lo que justifica el plan.
  //     Iban al final, tras las remisiones, donde quedaban huérfanas.
  const orden = (src: string, marcas: string[]) => marcas.map((m) => src.indexOf(m));
  const creciente = (xs: number[]) => xs.every((x, i) => x > 0 && (i === 0 || x > xs[i - 1]));

  it("en la pantalla", () => {
    const ix = orden(PANTALLA_PAGE, [
      "<HcAntecedentes",
      "<CompositionSection",
      "<HcResumenDiagnostico",
      "<HcMetaTerapeutica",
      "<HcObjetivoTratamiento",
      "<HcRutasActivadas",
      "<HcPlanNutricional",
      "<HcRecomendaciones",
      "<HcRemisiones",
    ]);
    expect(ix.every((i) => i > 0), "falta uno de los bloques").toBe(true);
    expect(creciente(ix), `orden roto: ${ix.join(" ")}`).toBe(true);
  });

  it("y en el PDF, el mismo", () => {
    const ix = orden(PDF, [
      'titulo="Antecedentes"',
      'titulo="Composición corporal"',
      'titulo="Índices ANI-BIS-E alterados"',
      'titulo="Resumen del diagnóstico"',
      'titulo="Objetivo del tratamiento"',
      'titulo="Rutas de atención activadas"',
      'titulo="Plan nutricional"',
      'titulo="Recomendaciones"',
      'titulo="Remisiones"',
    ]);
    expect(ix.every((i) => i > 0), "falta una de las secciones").toBe(true);
    expect(creciente(ix), `orden roto: ${ix.join(" ")}`).toBe(true);
  });
});

describe("los decimales los fija el corte, también en la tabla de composición", () => {
  it("el IMC va a UN decimal, que es la resolución de su corte 18,5-24,9", () => {
    // La regla vivía en `indicator-ranges` (los doce indicadores ANI) y esta tabla, que es la OTRA capa
    // de display, no la aplicaba: salía 25,66 al lado de una referencia 18,5-24,9. Familia de "barrer
    // todos los sitios aplica a una REGLA, no solo a un umbral".
    // SE AFIRMA POR EL RESULTADO, no por el texto del mecanismo: la primera version de este candado
    // pegaba la linea que propaga `decimals` y se puso roja al cambiarla por el enganche con la tabla
    // unica, sin que el IMC dejara de salir con un decimal. Un candado que se cae al mover una linea
    // se pone rojo por el parseo, no por la regla.
    const comp = buildComposition({ peso: 80.4, talla: 177, FM: 18, FFM: 62.4 }, null);
    const imc = [...comp.eval, ...comp.diag]
      .flatMap((n) => n.rows)
      .find((r) => r.key === "imc");
    expect(imc, "el control: la fila del IMC tiene que existir").toBeTruthy();
    expect(imc?.decimals, "el IMC va a un decimal, la resolucion de su corte").toBe(1);
  });
});
