import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { Diana } from "@/modules/diagnoses/components/diana";
import { DianaExplorer } from "@/modules/diagnoses/components/maps-section";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 15 DEL COTEJO (2026-09-05): el bloque de la Diana no repite el contenido del estado.
//
// Santiago: "veo ese bloque de la Diana muy saturado de información, revisa qué información de esa se
// repite". Y se repetia: dentro de la MISMA card, el panel del estado del paciente traia los cinco textos
// del estado (enfermedades, mecanismos, biomarcadores, riesgos, nutraceuticos) y dos centimetros mas abajo
// estaban otra vez, en las seis tarjetas de contenido.
//
// EL REPARTO QUE QUEDA, y es el que este candado fija: el PANEL lleva la DEFINICION del estado (numero,
// ejes y la tabla de siete, todo derivable para cualquier celda) y las TARJETAS llevan el CONTENIDO. La
// narrativa vuelve al panel solo cuando es una REFERENCIA explorada, porque de esa celda no hay tarjetas.

const PANEL = "src/modules/diagnoses/components/maps-section.tsx";

const CONTENIDO = {
  diagnosisName: "DIAGNOSTICO-MARCA",
  mechanism: "MECANISMO-MARCA",
  biomarkers: "BIOMARCADOR-MARCA",
  risks: "RIESGO-MARCA",
  suggestedNutraceuticals: "NUTRACEUTICO-MARCA",
};

function render() {
  return renderToStaticMarkup(
    createElement(DianaExplorer, {
      bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
      stateNumber: 41,
      frSectorName: "Reserva",
      structuralName: "Equilibrado",
      patientContent: CONTENIDO,
      statesContent: {},
    }),
  );
}

describe("el bloque de la Diana no repite el contenido del estado (cotejo punto 15)", () => {
  it("el panel del paciente NO trae los cuatro textos que ya estan en las tarjetas", () => {
    const html = render();
    for (const marca of [
      CONTENIDO.mechanism,
      CONTENIDO.biomarkers,
      CONTENIDO.risks,
      CONTENIDO.suggestedNutraceuticals,
    ]) {
      expect(html, marca).not.toContain(marca);
    }
  });

  it("el nombre del estado SI se queda: es lo que identifica al panel, no contenido de tarjeta", () => {
    // Control de que la asercion de arriba compara algo: si el panel no renderizara nada, tambien
    // pasaria. Este caso demuestra que el panel si esta y si escribe lo suyo.
    expect(render()).toContain(CONTENIDO.diagnosisName);
  });

  it("la narrativa sigue existiendo para la celda EXPLORADA (ahi no hay tarjetas)", () => {
    // Se afirma sobre la fuente porque llegar a ese panel exige dos clics (explorar y elegir celda).
    const src = sinComentarios(readFileSync(PANEL, "utf8"));
    const i = src.indexOf("isPatient ? null : (");
    expect(i, "la narrativa esta condicionada a la referencia").toBeGreaterThan(-1);
    const rama = src.slice(i, i + 700);
    for (const etiqueta of [
      "Mecanismos bioquímicos / Disfunción celular",
      "Biomarcadores clave",
      "Riesgos clínicos",
      "Nutracéuticos sugeridos",
    ]) {
      expect(rama, etiqueta).toContain(etiqueta);
    }
  });

  it("las dos lineas que ya estaban en la tabla de siete no se repiten en la rejilla de abajo", () => {
    // "Estado EFR N de 81" es la fila "Estado EFR" de la tabla, y "Estado funcional bioeléctrico
    // (IFC × IRC)" es su fila "Anillo (función-riesgo)". El fenotipo MCCB si se queda: no esta en la tabla.
    const res = sinComentarios(
      readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
    );
    expect(res).not.toContain('label="Estado funcional bioeléctrico (IFC × IRC)"');
    expect(res).toContain('label="Fenotipo estructural (FMI × FFMI)"');
  });
});

describe("rotulos de sector de la Diana: legibles (cotejo punto 15)", () => {
  // NO se fija el ancho en rem: seria una magnitud arbitraria, y una magnitud arbitraria se afloja el dia
  // que estorbe. Lo que se fija es la RELACION que estaba rota: el salto entre renglones tiene que ser
  // MAYOR que el cuerpo de la letra. Con salto 6 y cuerpo 6 los dos renglones se tocaban, y eso es lo que
  // Santiago vio como "FMI BajoFFMI Bajo" difuminado.
  it("el salto entre los renglones del rotulo supera el cuerpo de la letra", () => {
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    // El segundo renglon del par ("FFMI ..."): su dy es el salto desde el primero.
    // Los cuerpos y los saltos pueden ser fraccionarios (6,5 y 7,5): el patron acepta decimales. Si
    // solo aceptara enteros, bajar el cuerpo a 6,5 lo pondria rojo por el PARSEO y no por la regla.
    const m = html.match(/<tspan[^>]*dy="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>FFMI/);
    expect(m, "el segundo renglon del par de bandas").not.toBeNull();
    const salto = Number(m![1]);
    const cuerpo = Number(m![2]);
    expect(salto).toBeGreaterThan(cuerpo);
  });

  // EL SOLAPE, que es lo que Santiago fotografio el 06-sep (captura `bug-diana`). Con el texto CENTRADO
  // en su punto, la mitad interior de cada rotulo se metia encima del anillo exterior, y peor en los
  // sectores casi horizontales (E3 a la derecha, E7 a la izquierda), que son los de texto mas ancho.
  //
  // NO SE FIJA UNA DISTANCIA, que seria una magnitud arbitraria y se aflojaria el dia que estorbe: se
  // fija la REGLA que lo evita, que el rotulo crezca hacia AFUERA. Un rotulo a la derecha del centro se
  // ancla al inicio y uno a la izquierda al final; los de arriba y abajo se quedan centrados, que ahi el
  // texto horizontal no cruza el disco.
  it("los rotulos laterales crecen HACIA AFUERA, no cruzando el disco", () => {
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    // Cada rotulo de sector es un <text> con su ancla y su x. Se comprueba la relacion: a la derecha del
    // centro (x > C) el ancla es "start"; a la izquierda, "end".
    const C = 160;
    // Se extrae cada atributo por separado y no en un solo patron: React emite los atributos en el orden
    // del JSX, y anclar el candado a ese orden lo convertiria en un detector de reordenamientos.
    const laterales = [...html.matchAll(/<text\b[^>]*>/g)]
      .map((m) => m[0])
      .map((tag) => ({
        anchor: tag.match(/text-anchor="([a-z]+)"/)?.[1] ?? null,
        x: Number(tag.match(/\bx="([\d.-]+)"/)?.[1] ?? NaN),
      }))
      .filter((t) => t.anchor != null && Number.isFinite(t.x) && Math.abs(t.x - C) > 60);
    expect(laterales.length, "hay rotulos laterales que comprobar").toBeGreaterThan(0);
    for (const t of laterales) {
      const esperado = t.x > C ? "start" : "end";
      expect(t.anchor, `el rotulo en x=${t.x} tiene que crecer hacia afuera`).toBe(esperado);
    }
  });

  // LOS ROTULOS DE ANILLO (A1..A9) VAN A LA IZQUIERDA DEL EJE VERTICAL, o sea dentro de E9 (segundo
  // smoke, punto 15b). Los teniamos en el centro del primer sector (20 grados), que cae a la DERECHA.
  //
  // SE VERIFICO EN SU CODIGO ANTES DE MOVERLOS, no en su captura, que es lo que Santiago pidio. Su v8
  // los dibuja con `x = CX - 4`, `y = CY - rr` y `text-anchor="end"`: pegados al eje por su lado
  // izquierdo y creciendo hacia afuera.
  it("los rotulos de anillo van a la IZQUIERDA del eje vertical, como en su archivo", () => {
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    const C = 160;
    const anillos = [...html.matchAll(/<text\b[^>]*>A(\d)<\/text>/g)];
    expect(anillos.length, "los nueve rotulos de anillo").toBe(9);
    for (const m of anillos) {
      const tag = m[0];
      const x = Number(tag.match(/\bx="([\d.-]+)"/)![1]);
      expect(x, `A${m[1]} tiene que quedar a la izquierda del eje`).toBeLessThan(C);
      expect(tag, `A${m[1]} crece hacia afuera`).toContain('text-anchor="end"');
    }
  });

  it("y siguen apilados en vertical, uno por anillo", () => {
    // Control: si todos cayeran en la misma y, estarian encimados y el caso de arriba pasaria igual.
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    const ys = [...html.matchAll(/<text\b[^>]*>A\d<\/text>/g)]
      .map((m) => Number(m[0].match(/\by="([\d.-]+)"/)![1]));
    expect(new Set(ys).size, "cada anillo en su propia altura").toBe(9);
  });

  it("el centro dice lo que significa: EFR en verde y #1 centro debajo", () => {
    // PORTADO DE SU ARCHIVO (tercer smoke), verificado en su codigo antes de ponerlo: su v8 dibuja
    // "EFR" en verde (#16a34a, font-weight 700) y debajo "#1 centro" en gris. Nosotros teniamos solo la
    // sigla, y en gris: el centro no decia lo que significa, que es donde empieza la escala.
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    expect(html).toContain(">EFR</text>");
    expect(html).toContain("#1 centro");
    // El verde va por TOKEN y no por su hex: `clinical-optimal` ES el verde que en Atlas significa
    // optimo, que es lo que ese rotulo dice, y ademas responde al tema oscuro.
    expect(html).toContain("fill-clinical-optimal");
  });

  it("el lienzo deja margen alrededor del dibujo para que el rotulo no quede a ras del borde", () => {
    const html = renderToStaticMarkup(
      createElement(Diana, {
        bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 2 },
        stateNumber: 41,
        frSectorName: "Reserva",
        structuralName: "Equilibrado",
      }),
    );
    const [minX, , w] = html
      .match(/viewBox="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    expect(minX).toBeLessThan(0);
    expect(w).toBeGreaterThan(320);
  });
});
