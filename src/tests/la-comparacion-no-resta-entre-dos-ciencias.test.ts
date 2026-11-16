import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { FollowupComparison } from "@/modules/followups/components/followup-comparison";
import type { FollowupComparison as Comparison } from "@/modules/followups/data/comparison-reader";
import { sonComparables } from "@/modules/followups/services/eb-trajectory";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA COMPARACION CON LA PREVIA NO RESTA ENTRE DOS CIENCIAS  ·  Santiago, smoke del 2026-11-15
//
// ═══ EL CASO EXACTO, EN SUS PALABRAS ═══
//
// *"El bloque «Comparación con la evaluación previa» en Seguimiento (paciente Smoke S Movil 1): las dos
// fechas son 13/7/2026, todos los indicadores iguales (cambio 0, mismo archivo, es prueba), pero «Riesgo
// integrado BAJO (20) -> ALTO (25)». Eso sale del cambio de motor, no del paciente."*
//
// Y TENIA RAZON: con los mismos datos crudos y la misma ciencia el DFI es identico. El salto solo puede
// venir de que la previa se sello con 3.x y la actual con 4.0.0, donde la v17 movio el dominio 2 en siete
// de cada diez consultas y el dominio 3 en una de cada diez.
//
// ═══ LO QUE ESTABA MAL NO ERA EL AVISO: ERA SU ULTIMA FRASE ═══
//
// El bloque YA avisaba del cruce de versiones, y a la vez afirmaba que *"el estado EFR y los indicadores
// siguen siendo comparables"*. Con el MINOR distinto eso es verdad por construccion (un minor no mueve
// ninguna clasificacion; es la razon por la que el 3.3.0 fue minor). Con el MAYOR distinto es falso, y es
// justo la frase que convierte un aviso en un permiso para leer la resta.
//
// Asi que el criterio es el que ya existe y que la serie, la tarjeta de respuesta y la EB del informe ya
// aplican: `sonComparables`, o sea la version MAYOR.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const base: Comparison = {
  currentDate: "2026-07-13",
  previousDate: "2026-07-13",
  currentEfrState: 33,
  previousEfrState: 29,
  currentRisk: { nivel: "ALTO", score: 25 },
  previousRisk: { nivel: "BAJO", score: 20 },
  indicators: [
    { code: "IFC", current: 4.5, previous: 4.5, delta: 0, lectura: "igual" },
    { code: "IRC", current: 2.2, previous: 2.0, delta: 0.2, lectura: "empeora" },
  ],
  engineVersionCross: null,
  mismaEscala: true,
};

const pintar = (c: Partial<Comparison>) =>
  renderToStaticMarkup(createElement(FollowupComparison, { comparison: { ...base, ...c } }));

/** El caso de Santiago: la previa con 3.x, la actual con 4.0.0. */
const CRUCE_DE_MAYOR = {
  engineVersionCross: { previous: "3.3.0", current: "4.0.0" },
  mismaEscala: false,
};
/** Un cruce de MINOR, que es el caso normal y si se puede restar. */
const CRUCE_DE_MINOR = {
  engineVersionCross: { previous: "4.0.0", current: "4.1.0" },
  mismaEscala: true,
};

describe("la regla es la que ya existe: el MAYOR del motor", () => {
  it("3.3.0 y 4.0.0 no son comparables; 4.0.0 y 4.1.0 si", () => {
    expect(sonComparables("3.3.0", "4.0.0")).toBe(false);
    expect(sonComparables("4.0.0", "4.1.0")).toBe(true);
    // La grafia vieja convive en produccion y no puede cambiar la respuesta.
    expect(sonComparables("anibise-1.4.0", "1.0.0")).toBe(true);
  });

  it("el lector la aplica, en vez de volver a decidir que es comparable", () => {
    const src = sinComentarios(readFileSync("src/modules/followups/data/comparison-reader.ts", "utf8"));
    expect(src).toContain("mismaEscala: sonComparables(cur.versions.engine, pre.versions.engine)");
  });
});

describe("con el MAYOR distinto, el bloque no resta", () => {
  it("lo dice como advertencia, y dice que la previa hay que recalcularla", () => {
    const html = pintar(CRUCE_DE_MAYOR);
    expect(html).toContain("ciencias distintas");
    expect(html).toContain("no se pueden");
    expect(html).toContain("recalcularse con la ciencia de hoy");
    // Y NO LA FRASE QUE DABA PERMISO. Era la mitad peligrosa del aviso viejo.
    expect(html, "sigue afirmando que son comparables").not.toContain("siguen siendo comparables");
  });

  it("y la columna del cambio no trae numeros: trae un guion y «no comparable»", () => {
    const html = pintar(CRUCE_DE_MAYOR);
    expect(html).toContain("no comparable");
    expect(html).toContain("Cambio (no comparable)");
    // UN "+0.2" EN ROJO ENTRE DOS CIENCIAS es un empeoramiento atribuido al paciente que puede ser del
    // modelo. Es lo que `sonComparables` existe para impedir.
    expect(html, "pinto el delta entre dos ciencias").not.toContain("+0.2");
    // SE BUSCA LA CELDA, no la palabra: la leyenda del pie habla de "empeorar" al explicar el color, y
    // un candado que mire el documento entero acusaria a esa frase.
    expect(html, "pinto la lectura clinica del delta").not.toContain(">empeora<");
    // Y LA LEYENDA DEL COLOR TAMPOCO VA: explica una columna que aqui dice «no comparable».
    expect(html).not.toContain("El color del cambio sale de la clasificación");
  });

  it("y el cambio de estado EFR se rotula «otra ciencia», no «cambio»", () => {
    const html = pintar(CRUCE_DE_MAYOR);
    expect(html).toContain("otra ciencia");
    // LOS DOS VALORES SIGUEN A LA VISTA: no se oculta nada, se deja de afirmar la resta.
    expect(html).toContain("29");
    expect(html).toContain("33");
  });
});

describe("con el mismo MAYOR, nada cambia: se resta como siempre", () => {
  it("el cruce de minor conserva el aviso calmado y el delta", () => {
    const html = pintar(CRUCE_DE_MINOR);
    expect(html).toContain("siguen siendo comparables");
    expect(html).toContain("+0.2");
    expect(html).toContain("empeora");
    expect(html).not.toContain("ciencias distintas");
  });

  it("y sin cruce ninguno no sale aviso de version", () => {
    const html = pintar({});
    expect(html).not.toContain("versiones distintas");
    expect(html).not.toContain("ciencias distintas");
    expect(html).toContain("+0.2");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA OTRA MITAD DE SU PREGUNTA: *"verifica que 25 sea «ALTO» con la escala vigente"*
//
// LA RESPUESTA ES QUE SI, Y QUE NO SALE DE LA ESCALA. Los cortes del nivel son sobre el score en tantos
// por uno (`engine.dfi`, su bloque del riesgo integrado): < 0,20 BAJO · < 0,45 MEDIO · < 0,70 ALTO ·
// resto CRITICO. Por esa tabla, 25 seria MEDIO.
//
// LO QUE LO SUBE SON CUATRO REGLAS SUYAS QUE PISAN LA TABLA, y estan en su archivo:
//   · cualquier dominio en severidad 3 -> el nivel no baja de ALTO;
//   · el dominio 4 en severidad 3 -> tampoco;
//   · el veto conductual con el dominio 1 o el 2 en >= 2 -> CRITICO;
//   · el dominio 1 y el 2 los dos en 3 -> CRITICO.
//
// O SEA QUE EL NIVEL **NO ES UNA FUNCION DEL NUMERO QUE SE MUESTRA**, y por eso "ALTO (25)" no es una
// contradiccion. El "BAJO (20)" tampoco: el score se muestra redondeado, asi que un 0,195 se imprime 20 y
// cae del lado BAJO.
//
// ESTE CASO FIJA LA ARITMETICA para que nadie "arregle" el par leyendolo como un defecto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el nivel de riesgo no se deriva del score que se muestra", () => {
  const DFI = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");

  it("los cortes del score son los suyos, y 0,25 cae en MEDIO por la tabla", () => {
    expect(DFI).toContain("score01<0.20?0:score01<0.45?1:score01<0.70?2:3");
  });

  it("y las cuatro reglas que lo suben siguen en su archivo", () => {
    expect(DFI).toContain("if(anySev3) nivel=Math.max(nivel,2);");
    expect(DFI).toContain("if(dom4.sev===3) nivel=Math.max(nivel,2);");
    expect(DFI).toContain("if(veto && (dom1.sev>=2||dom2.sev>=2)) nivel=3;");
    expect(DFI).toContain("if(dom1.sev===3 && dom2.sev===3) nivel=3;");
  });

  it("el score se muestra REDONDEADO, asi que 20 puede ser un 0,195 que es BAJO", () => {
    expect(DFI).toContain("score:Math.round(score01*100)");
  });
});
