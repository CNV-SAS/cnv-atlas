import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FREQ_GROUPS, catColor } from "@/clinical-engine";
import { encabezadoAntesDe } from "@/clinical-engine/encabezados-frecuencia";
import { SurveyReadonly } from "@/modules/evaluations/components/survey-readonly";
import type {
  SurveyAnswerView,
  SurveyDomain,
} from "@/modules/evaluations/data/survey-answers-types";

// CANDADO DE LOS TRES ENCABEZADOS de la matriz de frecuencia.
//
// Su regla: "la agrupacion que ve el paciente es esa misma: EL ORDEN ES EL MENSAJE". Los encabezados
// hacen visible esa agrupacion, y por eso SOLO se pudieron poner despues de corregir el orden: con las
// carnes rojas al final, un encabezado "procesados a reducir" habria quedado encima de ellas, que su
// modelo clasifica como NEUTRAS. El encabezado habria hecho visible, y por tanto peor, un error implicito.
//
// Y DONDE VAN (2026-08-31): SOLO en las vistas del PROFESIONAL. Se retiraron de la encuesta del paciente
// por sesgo de deseabilidad; el detalle esta escrito en encabezados-frecuencia.ts y va a la ronda. Ese
// alcance se fija abajo con dos aserciones de SITIO, no solo de funcion: el defecto que se teme no es que
// la funcion calcule mal, es que alguien vuelva a montarla en la pantalla del paciente.

const PHASE_FORM = "src/modules/evaluations/components/survey-phase-form.tsx";
const READONLY = "src/modules/evaluations/components/survey-readonly.tsx";
const EDIT_FORM = "src/modules/evaluations/components/survey-edit-form.tsx";

const claves = () =>
  [...readFileSync("supabase/seed.ts", "utf8").matchAll(/^\s*\{ key: "(d1_\d+_i)"/gm)].map((m) => m[1]);

describe("los encabezados salen de la categoría, no de una posición escrita a mano", () => {
  it("aparecen EXACTAMENTE tres, uno por categoría, en el orden del modelo", () => {
    const ks = claves();
    const vistos = ks
      .map((k, i) => encabezadoAntesDe(k, ks[i - 1] ?? null))
      .filter((e) => e !== null)
      .map((e) => e!.etiqueta);
    expect(vistos).toEqual([
      "Alimentación Real protectora",
      "Alimentación Real energética (moderar)",
      "Procesados y ultraprocesados (PCBU)",
    ]);
  });

  it("cada encabezado cae en el PRIMER ítem de su bloque", () => {
    const ks = claves();
    // Protector abre en d1_1_i; neutro en d1_8_i; riesgo en d1_11_i. Se derivan de FREQ_GROUPS para que
    // el dia que el mueva una categoria esto siga diciendo la verdad y no una foto de hoy.
    for (const cat of ["protector", "neutro", "riesgo"]) {
      const primera = `d1_${FREQ_GROUPS.find((g) => g.cat === cat)!.n}_i`;
      const i = ks.indexOf(primera);
      expect(encabezadoAntesDe(ks[i], ks[i - 1] ?? null)).not.toBe(null);
      // Y en el SIGUIENTE item de la misma categoria no se repite.
      if (i + 1 < ks.length) {
        const sigue = FREQ_GROUPS.find((g) => `d1_${g.n}_i` === ks[i + 1])?.cat === cat;
        if (sigue) expect(encabezadoAntesDe(ks[i + 1], ks[i])).toBe(null);
      }
    }
  });

  it("las etiquetas y los colores son los SUYOS (catLabel/catColor del frozen), solo sin el emoji", () => {
    // No una copia nuestra: dos fuentes del mismo texto sin nada que las compare es exactamente como
    // empezo el defecto del orden. Lo unico que cambia es la forma, que es nuestra: la interfaz no lleva
    // emoji. Si el cambia una etiqueta o un color, esto cambia con el.
    const patron = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8");
    const ks = claves();
    const vistos = ks.map((k, i) => encabezadoAntesDe(k, ks[i - 1] ?? null)).filter((e) => e !== null);
    for (const e of vistos) {
      expect(patron).toContain(e!.etiqueta);
      expect(patron).toContain(e!.color);
    }
    // El color no es decorativo: es el de SU categoria, no uno cualquiera de los tres.
    expect(encabezadoAntesDe("d1_1_i", null)!.color).toBe(catColor.protector);
    expect(encabezadoAntesDe("d1_11_i", "d1_15_i")!.color).toBe(catColor.riesgo);
  });

  it("una pregunta que no es de la matriz no lleva encabezado", () => {
    expect(encabezadoAntesDe("d2_21", "d1_14_i")).toBe(null);
    expect(encabezadoAntesDe(null, "d1_1_i")).toBe(null);
    expect(encabezadoAntesDe("d1f_sal_i", "d1_14_i")).toBe(null);
  });
});

describe("el alcance: profesional sí, paciente no", () => {
  it("la encuesta DEL PACIENTE no monta los encabezados", () => {
    // La asercion va sobre el SITIO DE LLAMADA y no sobre la funcion, porque el defecto que se teme es una
    // OMISION al reves: que alguien los vuelva a poner ahi. Con la funcion intacta, un candado sobre ella
    // seguiria verde con el rotulo de vuelta en la pantalla del paciente.
    const form = readFileSync(PHASE_FORM, "utf8");
    expect(
      form,
      "Volvieron los encabezados de categoría a la encuesta del PACIENTE. Se retiraron el 2026-08-31 por " +
        "sesgo de deseabilidad (decisión de Santiago, y está preguntado en la ronda del 31). Si Gildardo " +
        "responde que se quedan, este test se invierte CITANDO su respuesta; no se borra.",
    ).not.toContain("encabezadoAntesDe");
  });

  it("las dos vistas del profesional sí los montan, con la banda de color", () => {
    // El otro lado de la misma moneda: sin esto, "no están en la del paciente" pasaria verde tambien si no
    // estuvieran en ninguna parte, que es como se perderian del todo.
    for (const ruta of [READONLY, EDIT_FORM]) {
      const src = readFileSync(ruta, "utf8");
      expect(src, `${ruta} ya no deriva el encabezado`).toContain("encabezadoAntesDe(");
      expect(src, `${ruta} ya no pinta la banda`).toContain("<EncabezadoDeFrecuencia");
    }
  });

  it("la banda usa el color inline, no una clase de Tailwind construida con la variable", () => {
    // Un valor arbitrario de Tailwind armado con una variable NO se compila y desaparece EN SILENCIO: la
    // clase no existe en el CSS y no hay error. Es el modo de fallo que este componente vino a cerrar
    // (los encabezados estaban renderizados y aun asi nadie los veia), asi que queda fijado.
    const src = readFileSync("src/modules/evaluations/components/encabezado-frecuencia.tsx", "utf8");
    expect(src).toContain("borderLeft");
    expect(src).not.toMatch(/\[\$\{/);
  });
});

describe("y RENDERIZANDO de verdad, no solo leyendo el archivo", () => {
  // POR QUE ESTE BLOQUE EXISTE. Las aserciones de arriba miran el CODIGO FUENTE, y eso alcanza para
  // "esta montado" pero no para "sale en el HTML". El defecto original fue justamente de esa clase: la
  // funcion era correcta, el componente la llamaba, y el rotulo no se leia en pantalla. Asi que la vista
  // del profesional se RENDERIZA y se cuenta lo que sale, que es lo unico que ve un profesional.

  const pregunta = (fieldKey: string | null, questionText: string): SurveyAnswerView => ({
    questionId: `q-${fieldKey ?? questionText}`,
    number: 1,
    questionText,
    questionHint: null,
    questionType: "opcion",
    fieldKey,
    usedInDiagnosis: false,
    answerValue: "Nunca",
    options: ["Nunca", "Todos los días"],
  });

  // Un dominio con la matriz en el ORDEN REAL (carnes rojas, d1_15_i, en la posicion 11) mas una pregunta
  // de fuera, para comprobar que no arrastra encabezado.
  const dominio: SurveyDomain = {
    section: "Alimentación",
    questions: [
      ...["d1_1_i", "d1_2_i", "d1_3_i", "d1_4_i", "d1_5_i", "d1_6_i", "d1_7_i"],
      ...["d1_8_i", "d1_9_i", "d1_10_i", "d1_15_i"],
      ...["d1_11_i", "d1_12_i", "d1_13_i", "d1_14_i"],
    ].map((k) => pregunta(k, `Grupo ${k}`)).concat(pregunta("d1f_sal_i", "¿Añade sal extra?")),
  };

  const html = renderToStaticMarkup(h(SurveyReadonly, { domains: [dominio] }));

  it("la vista del profesional saca los tres, UNA vez cada uno", () => {
    for (const etiqueta of [
      "Alimentación Real protectora",
      "Alimentación Real energética (moderar)",
      "Procesados y ultraprocesados (PCBU)",
    ]) {
      expect(html.split(etiqueta).length - 1, `"${etiqueta}" no sale exactamente una vez`).toBe(1);
    }
  });

  it("y salen CON su banda de color, no como texto plano", () => {
    // Que el texto este en el HTML no basta: el defecto era que estaba y no se leia como encabezado.
    expect(html).toContain(`border-left:4px solid ${catColor.protector}`);
    expect(html).toContain(`border-left:4px solid ${catColor.riesgo}`);
  });

  it("la banda del bloque neutro va antes de las carnes rojas, no después", () => {
    // La comprobacion clinica de verdad: si el orden se rompiera, las carnes rojas quedarian bajo el
    // rotulo de procesados, que es lo contrario de lo que dice su modelo.
    const iNeutro = html.indexOf("Alimentación Real energética (moderar)");
    const iCarnes = html.indexOf("Grupo d1_15_i");
    const iRiesgo = html.indexOf("Procesados y ultraprocesados (PCBU)");
    expect(iNeutro).toBeGreaterThan(-1);
    expect(iCarnes).toBeGreaterThan(iNeutro);
    expect(iRiesgo).toBeGreaterThan(iCarnes);
  });
});
