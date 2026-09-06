import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 29 DEL COTEJO (urgente). En la historia clínica de Atlas el bloque "Objetivo del
// tratamiento" decía **"No se registró"** justo donde su documento encabeza con **"Dieta Normocalórica de
// 2408 kcal/día"**.
//
// LA CAUSA: aquí sólo viajaba el TEXTO LIBRE que escribe el profesional. Y esa línea no es texto libre:
// la calcula el motor, ya sale en el panel de tratamiento encima del campo, y ES la prescripción. Un
// documento probatorio no puede decir que no se registró un objetivo que el sistema calculó y mostró.
//
// Y AL ARREGLARLO SALIÓ UN SEGUNDO DEFECTO, más serio, en el mismo sitio: el lector de la historia llamaba
// al motor con `null, null` en el objetivo y el PAL. El propio lector documenta lo que eso hace
// ("`tipoEnergia` sale de comparar el objetivo contra el GET, y su motor lo recalcula DESPUÉS de aplicar
// `edit.kcal_obj`"), y en el panel se corrigió el 2026-09-01. La HISTORIA CLÍNICA se quedó con los dos
// nulls, así que el documento probatorio podía decir un TIPO DE DIETA distinto del que el profesional
// tenía en pantalla.

const READER = sinComentarios(
  readFileSync("src/modules/reports/data/hc-documento-reader.ts", "utf8"),
);
const PANTALLA = sinComentarios(
  readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8"),
);
const PDF = sinComentarios(readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8"));
const PAGE = sinComentarios(readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8"));

describe("el objetivo del tratamiento son DOS piezas, no una", () => {
  it("el lector arma la línea del modelo, además del texto del profesional", () => {
    expect(READER).toContain("objetivoModelo:");
    expect(READER).toContain("objetivoTratamiento: protocol?.objetivoTexto ?? null");
  });

  it("y esa línea sale de la MISMA prescripción y la MISMA cadena efectiva que el panel", () => {
    // Si saliera de otra cuenta, la historia y el panel podrían decir dietas distintas de la misma
    // consulta, que es el defecto que esta pieza vino a cerrar en el plan nutricional.
    expect(READER).toContain("prescripcion.tipoEnergia.toLowerCase()");
    expect(READER).toContain("Math.round(efectivoHc.calorico.kcalObj)");
  });

  it("EL SEGUNDO DEFECTO: el motor recibe el objetivo y el PAL efectivos, ya no dos nulls", () => {
    // SE AFIRMA QUE LOS DOS VIAJAN, no la forma de escribirlos. La version anterior de este candado
    // pegaba el ternario literal (`efectivoHc ? ... : null`) y se puso rojo el 2026-09-06 cuando el
    // barrido lo reescribio como `efectivoHc?.calorico.pal ?? null`: mismo comportamiento, otra sintaxis.
    // Un candado que se cae al cambiar de operador se pone rojo por el PARSEO y no por la regla.
    const args = READER.slice(READER.indexOf("getPrescripcionNutricional("));
    const llamada = args.slice(0, args.indexOf(").catch"));
    expect(llamada).toContain("efectivoHc");
    expect(llamada).toContain("calorico.kcalObj");
    expect(llamada).toContain("calorico.pal");
    // Y el control de la asercion negativa: que ya no queden los dos nulls sueltos que habia.
    expect(llamada.replace(/s/g, "")).not.toContain("null,null,");
  });
});

describe('"No se registró" queda para cuando faltan LOS DOS', () => {
  it("en pantalla", () => {
    expect(PANTALLA).toContain('{!modelo && (!texto || texto.trim() === "") ? (');
  });

  it("y en el PDF, con la misma condición: los dos documentos dicen lo mismo", () => {
    // El propio PDF documenta que ya se le escapó una vez la diferencia con la pantalla (dos bloques que
    // en pantalla decían "No se registró" y en el PDF se omitían). Aquí se fija que la condición sea la
    // misma en los dos.
    expect(PDF).toContain(
      '{!hc.objetivoModelo && (!hc.objetivoTratamiento || hc.objetivoTratamiento.trim() === "") ? (',
    );
  });

  it("y los dos pintan primero el modelo y después lo que escribió el profesional", () => {
    expect(PANTALLA.indexOf("{modelo ?")).toBeLessThan(PANTALLA.indexOf('{texto && texto.trim() !== ""'));
    expect(PDF.indexOf("{hc.objetivoModelo ?")).toBeLessThan(PDF.indexOf("{hc.objetivoTratamiento &&"));
  });
});

describe("la pantalla de la evaluación también lo pasa: no basta con el lector", () => {
  it("el sitio de llamada le da la línea del modelo", () => {
    // Aserción sobre el SITIO DE LLAMADA: esa pantalla NO usa el lector de la historia, arma el bloque con
    // sus propios datos. Con el lector arreglado y el sitio sin tocar, el defecto seguiría vivo en la
    // superficie que el profesional mira primero.
    expect(PAGE).toContain("<HcObjetivoTratamiento");
    expect(PAGE).toContain("prescripcionNutricional.tipoEnergia.toLowerCase()");
  });
});
