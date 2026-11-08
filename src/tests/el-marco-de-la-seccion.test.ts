import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  dominioDeLaClave,
  marcoDeLaSeccion,
  MARCOS_DE_LA_ENCUESTA,
} from "@/modules/evaluations/marco-de-la-seccion";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL MARCO DE REFERENCIA DE CADA SECCION  ·  v15 §7.1 y §2.6, 2026-11-07
//
// ═══ QUE SE VIGILA, Y POR QUE NO ES COPY ═══
//
// Su v15: *"Cada sección muestra su marco... El marco de dos semanas también se agrega a la encuesta de
// línea base."* Un marco no es ayuda de pantalla: es la VENTANA DE RECUERDO del instrumento. La misma
// pregunta contestada sobre el ultimo año y sobre las ultimas dos semanas son dos preguntas distintas, y
// sin marco cada paciente elige su propia ventana. Dos encuestas dejan de ser comparables sin que nada
// falle y sin que nadie lo note.
//
// Y LOS OCHO TIENEN QUE ESTAR: el que falte deja esa seccion con la ventana abierta, que es el estado que
// habia antes. Un marco a medias es peor que ninguno, porque hace creer que todas lo llevan.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const FORMULARIO = readFileSync(
  "src/modules/evaluations/components/survey-phase-form.tsx",
  "utf8",
);
const SOLO_LECTURA = readFileSync(
  "src/modules/evaluations/components/survey-readonly.tsx",
  "utf8",
);

describe("los ocho dominios llevan su marco, y es el que el escribio", () => {
  it("D1 es patron usual de consumo, no un recordatorio de 24 horas", () => {
    // Su decision 2 del 30 de octubre, explicita: *"D1 es patrón usual de consumo. No es un recordatorio
    // de 24 horas, que Gildardo considera poco confiable."*
    expect(MARCOS_DE_LA_ENCUESTA.d1).toContain("patrón usual de consumo");
    expect(MARCOS_DE_LA_ENCUESTA.d1, "D1 volvio a ser un recordatorio de 24 horas").not.toContain(
      "24 horas",
    );
  });

  it("D2, D3, D4, D6, D7 y D8 son las ULTIMAS DOS SEMANAS", () => {
    for (const d of ["d2", "d3", "d4", "d6", "d7", "d8"]) {
      expect(MARCOS_DE_LA_ENCUESTA[d], `${d} sin su marco de dos semanas`).toContain(
        "últimas dos semanas",
      );
    }
  });

  it("y D5 es la SITUACION ACTUAL, que no es una ventana de recuerdo", () => {
    // D5 son antecedentes y estilo de vida: preguntarlos "en las últimas dos semanas" seria otra
    // pregunta. Es la excepcion que su propia lista hace, y por eso tiene su caso.
    expect(MARCOS_DE_LA_ENCUESTA.d5).toContain("situación actual");
    expect(MARCOS_DE_LA_ENCUESTA.d5).not.toContain("dos semanas");
  });

  it("no falta ninguno de los ocho", () => {
    for (let n = 1; n <= 8; n += 1) {
      expect(MARCOS_DE_LA_ENCUESTA[`d${n}`], `falta el marco de d${n}`).toBeTruthy();
    }
    expect(Object.keys(MARCOS_DE_LA_ENCUESTA)).toHaveLength(8);
  });
});

describe("el marco se deriva de la CLAVE del instrumento, no del rotulo de la seccion", () => {
  it("lee el dominio de las tres formas de clave que usa la encuesta", () => {
    expect(dominioDeLaClave("d1_1_i")).toBe("d1");
    // La matriz de horarios de D1 lleva una `f` en medio (`d1f_sal_i`), y es de D1 igual.
    expect(dominioDeLaClave("d1f_sal_i")).toBe("d1");
    expect(dominioDeLaClave("d7_agua")).toBe("d7");
  });

  it("y no inventa un dominio con una clave que no es de la encuesta", () => {
    expect(dominioDeLaClave(null)).toBeNull();
    expect(dominioDeLaClave("")).toBeNull();
    expect(dominioDeLaClave("motivo")).toBeNull();
    // No hay D9: un dominio fuera de rango no puede caer en el marco de otro.
    expect(dominioDeLaClave("d9_1_i")).toBeNull();
  });

  it("toma la PRIMERA clave que exista, no la primera pregunta", () => {
    // Hay preguntas sin `field_key` (las que no alimentan el motor) repartidas por las secciones. Mirar
    // solo la primera dejaria secciones enteras sin marco segun donde cayera una de esas.
    const marco = marcoDeLaSeccion([{ fieldKey: null }, { fieldKey: null }, { fieldKey: "d3_23" }]);
    expect(marco?.dominio).toBe("d3");
    expect(marco?.texto).toContain("últimas dos semanas");
  });

  it("y una seccion sin ninguna clave de encuesta NO pinta marco", () => {
    // El paso "Sobre ti" no es un dominio del instrumento: ponerle una ventana de recuerdo seria
    // afirmar algo sobre unos datos de perfil que no la tienen.
    expect(marcoDeLaSeccion([{ fieldKey: null }])).toBeNull();
    expect(marcoDeLaSeccion([])).toBeNull();
  });

  it("NO se busca por el rotulo en español, que es lo que se pierde en silencio", () => {
    // El icono y el parrafo de ayuda si se buscan por rotulo, y para ellos esta bien: renombrar la
    // seccion cuesta un icono. Aqui costaria la ventana de recuerdo de un cuestionario clinico, sin que
    // ningun test de tipos lo viera.
    const limpio = sinComentarios(readFileSync("src/modules/evaluations/marco-de-la-seccion.ts", "utf8"));
    expect(limpio, "el marco volvio a indexarse por el rotulo de la seccion").not.toContain(
      "Alimentación",
    );
    expect(limpio).toContain("const MARCO_POR_DOMINIO: Record<string, string>");
  });
});

describe("y sale en las DOS superficies, con el mismo texto", () => {
  it("en la encuesta del paciente, ANTES del parrafo de ayuda", () => {
    const limpio = sinComentarios(FORMULARIO);
    expect(limpio).toContain("marcoDeLaSeccion(s.questions)");
    expect(
      limpio.indexOf("marcoDeLaSeccion(s.questions)"),
      "el marco quedo despues de la ayuda: la ayuda dice como responder y el marco sobre que periodo",
    ).toBeLessThan(limpio.indexOf("SECTION_INTRO[s.title] ?"));
  });

  it("y en la vista del profesional, del MISMO modulo", () => {
    // Si el profesional leyera otra ventana que la que vio el paciente, las dos superficies dirian cosas
    // distintas sobre el mismo dato. Es la regla de la casa: una fuente por hecho.
    expect(SOLO_LECTURA).toContain('from "../marco-de-la-seccion"');
    expect(SOLO_LECTURA).toContain("marcoDeLaSeccion(d.questions)");
  });
});
