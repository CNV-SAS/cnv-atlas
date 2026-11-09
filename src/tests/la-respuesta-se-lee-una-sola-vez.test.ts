import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  parsePorProducto,
  textoDeLaRespuesta,
  textoPorProducto,
  valoresDeLaRespuesta,
} from "@/modules/evaluations/respuesta-en-texto";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UNA RESPUESTA GUARDADA SE LEE DE UNA SOLA MANERA  ·  los defectos del smoke del 2026-11-09
//
// ═══ LOS DOS QUE SANTIAGO VIO, Y QUE SON EL MISMO ═══
//
//   · en la encuesta, el paciente leia: *"La vez pasada respondiste: [\"Ninguno\"]"*;
//   · en la vista del profesional, el Modulo S salia como `{"77777777-...-702":"Lo suspendió"}`.
//
// Dos superficies distintas ensenandole a una persona la estructura de la base, cada una por su cuenta.
// La causa comun: "como se lee una respuesta guardada" estaba decidido en CUATRO sitios (los widgets, la
// redaccion del SOAP, el CSV y el mapa de antecedentes de la historia clinica), asi que no habia una
// respuesta a esa pregunta, habia cuatro.
//
// ═══ Y UN TERCERO, PEOR, QUE SALIO DE MEDIR EL SMOKE ═══
//
// El bloque de confirmacion emitia la respuesta anterior TAL CUAL en un solo campo, y el servidor, que
// envuelve en un arreglo todo lo que llega de una pregunta multiple, la guardaba como un arreglo cuyo
// unico texto es otro arreglo. Medido en la nube: `d5_40`, `d5_42`, `d6_43` y `d6_44` de la consulta del
// smoke quedaron asi. Consecuencias: las pantallas mostraban SIN RESPONDER una pregunta que el paciente
// si confirmo, y en `d5_39` (que alimenta el diagnostico) el motor no habria reconocido ningun
// diagnostico personal.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("los valores de una respuesta", () => {
  it("una multiple es su arreglo de textos", () => {
    expect(valoresDeLaRespuesta('["Asma","Rinitis crónica"]')).toEqual(["Asma", "Rinitis crónica"]);
  });

  it("una opcion unica es su texto, tal cual", () => {
    expect(valoresDeLaRespuesta("A veces")).toEqual(["A veces"]);
  });

  it("vacio y el arreglo vacio no son respuestas", () => {
    expect(valoresDeLaRespuesta("")).toEqual([]);
    expect(valoresDeLaRespuesta("[]")).toEqual([]);
    expect(valoresDeLaRespuesta(null)).toEqual([]);
  });

  it("DESENVUELVE el arreglo dentro del arreglo que escribio el defecto del 9 de noviembre", () => {
    // Es la fila que de verdad quedo en la nube. Sin desenvolverla, la pantalla pinta los corchetes y la
    // opcion "Ninguna" del catalogo sale apagada, o sea: pregunta sin responder.
    expect(valoresDeLaRespuesta('["[\\"Ninguna\\"]"]')).toEqual(["Ninguna"]);
    expect(valoresDeLaRespuesta('["[\\"Asma\\",\\"Rinitis\\"]"]')).toEqual(["Asma", "Rinitis"]);
  });

  it("y no adivina: un texto que solo EMPIEZA con corchete se conserva", () => {
    expect(valoresDeLaRespuesta("[sin cerrar")).toEqual(["[sin cerrar"]);
  });

  it("y un valor que no es texto no tumba la pantalla", () => {
    // La columna es `text`, asi que esto no deberia pasar. Pero lo llaman cuatro superficies, una de
    // ellas la exportacion de una consulta, y perder un archivo por un valor raro es peor que mostrarlo.
    expect(valoresDeLaRespuesta(3 as unknown as string)).toEqual(["3"]);
  });
});

describe("el S1 y el S2: una respuesta por producto", () => {
  const GUARDADO = '{"p-1":"Lo suspendió","p-2":"Todos los días"}';

  it("se leen como el objeto que son", () => {
    expect(parsePorProducto(GUARDADO)).toEqual({ "p-1": "Lo suspendió", "p-2": "Todos los días" });
  });

  it("y se escriben con el NOMBRE del producto, nunca con su id", () => {
    const texto = textoPorProducto(GUARDADO, { "p-1": "MULTI-CELL BASE", "p-2": "OMEGA COMPLEX" });
    expect(texto).toBe("MULTI-CELL BASE: Lo suspendió · OMEGA COMPLEX: Todos los días");
    expect(texto, "un id no es informacion: es ruido que parece un desperfecto").not.toContain("p-1");
  });

  it("si el producto no se puede nombrar, se dice, y la respuesta no se pierde", () => {
    expect(textoPorProducto(GUARDADO, {})).toContain("Producto no identificado: Lo suspendió");
  });

  it("y el texto de la respuesta sabe del tipo de pregunta", () => {
    expect(textoDeLaRespuesta(GUARDADO, { tipo: "opcion_por_producto", nombres: { "p-1": "A", "p-2": "B" } })).toBe(
      "A: Lo suspendió · B: Todos los días",
    );
    expect(textoDeLaRespuesta('["Asma","Rinitis"]')).toBe("Asma, Rinitis");
    expect(textoDeLaRespuesta('["Asma","Rinitis"]', { separador: " | " })).toBe("Asma | Rinitis");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LAS CUATRO SUPERFICIES LEEN POR AHI  ·  el candado que impide que vuelva a haber cuatro
//
// No basta con arreglar las cuatro: la cuarta copia nacio porque escribir el parseo a mano es mas facil
// que buscar donde vive. Asi que lo que se vigila es que ninguna de las cuatro vuelva a parsear por su
// cuenta la respuesta de una pregunta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const SUPERFICIES = [
  "src/modules/evaluations/components/survey-widgets.tsx",
  "src/modules/reports/services/encuesta-redactada.ts",
  "src/modules/evaluations/services/exportar-respuestas.ts",
  "src/modules/reports/data/hc-antecedentes-map.ts",
];

describe("las cuatro superficies que escriben una respuesta", () => {
  it.each(SUPERFICIES)("%s usa la lectura compartida", (archivo) => {
    const fuente = readFileSync(archivo, "utf8");
    expect(fuente, `${archivo} no importa la lectura compartida`).toContain("respuesta-en-texto");
  });

  it.each(SUPERFICIES)("%s ya no parsea la respuesta por su cuenta", (archivo) => {
    const limpia = sinComentarios(readFileSync(archivo, "utf8"));
    expect(limpia, `${archivo} volvio a parsear la respuesta a mano`).not.toMatch(
      /JSON\.parse\((answerValue|raw|valor|s)\b/,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL BLOQUE DE CONFIRMACION EMITE LO QUE EL SERVIDOR ESPERA
//
// `readAnswersFromForm` junta en un arreglo JSON todos los campos `answer_<id>` de una pregunta
// multiple. Asi que confirmar una multiple es emitir UN CAMPO POR OPCION, igual que su widget. Un solo
// campo con el arreglo dentro es el defecto del 9 de noviembre.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("los tres controles de la CNV-S", () => {
  const CNVS = readFileSync("src/modules/evaluations/components/cnvs-widgets.tsx", "utf8");

  it("al confirmar una pregunta multiple, emite un campo por opcion", () => {
    const limpia = sinComentarios(CNVS);
    expect(limpia).toContain('q.type === "opcion_multiple"');
    expect(limpia).toContain("valoresDeLaRespuesta(anterior).map(");
  });

  it("y le ensena al paciente la respuesta anterior en palabras, con el lector compartido", () => {
    const limpia = sinComentarios(CNVS);
    expect(limpia).toContain("La vez pasada respondiste:");
    expect(limpia).toContain("<SurveyAnswerReadonly");
    expect(limpia, "la pantalla volvio a redactar la respuesta anterior a mano").not.toContain(
      "<strong>{anterior}</strong>",
    );
  });

  it("y las pastillas son las de la casa, no unas propias", () => {
    // La elegida quedaba en NEGRO mientras el resto de la encuesta la pinta en el azul de marca: el
    // paciente lo lee como otra clase de control, o como un desperfecto.
    const limpia = sinComentarios(CNVS);
    expect(limpia).toContain("pillClass(activo)");
    expect(limpia, "volvio a nacer un estilo de pastilla local").not.toContain("bg-foreground");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE PRESENTA Y LO QUE SE EXIGE SON LA MISMA LISTA  ·  hazard 6
//
// El defecto: *"el envio dice que falta la pregunta 2 cuando no se mostro porque el S1 fue «Todos los
// días»"*. El S2 se descartaba DENTRO de su control y el recuento no se enteraba, asi que el aviso pedia
// responder una pregunta que no estaba en la pantalla, y no habia forma de alcanzarla.
//
// SE VIGILA LA FORMA: una sola lista (`questions`) de la que salen el pintado, el denominador de la
// barra, el recuento y las que faltan al enviar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el formulario de la encuesta: una sola lista", () => {
  const FORM = sinComentarios(
    readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8"),
  );

  // ═══ EL CRITERIO SE MUDO, Y POR ESO ESTE CASO CAMBIO (2026-11-09, tarde) ═══
  //
  // Estaba escrito dentro de este formulario, y eso es lo que permitio que la pantalla de edicion
  // tuviera el suyo. Ahora vive en `lo-que-se-presenta`, que es un modulo neutro, y las TRES pantallas
  // lo llaman. Lo que aqui se vigila es que esta siga llamandolo; el COMPORTAMIENTO de la regla lo
  // comprueban los casos de `la-edicion-presenta-lo-mismo-que-la-encuesta`, que es donde tiene que
  // estar: una regla compartida no se comprueba leyendo el codigo de uno de sus clientes.
  it("el criterio de lo que se presenta no vuelve a vivir dentro del formulario", () => {
    expect(FORM).toContain("loQueSePresenta(items, {");
    expect(FORM, "volvio a decidir el S2 por su cuenta").not.toContain('"cnvs_s2" &&');
    expect(FORM, "volvio a decidir los retirados por su cuenta").not.toContain('=== "retirar"');
  });

  it("y le pasa los cuatro datos que deciden, no tres", () => {
    expect(FORM).toContain("esCnvs: cnvs != null");
    expect(FORM).toContain("sinProductos,");
    expect(FORM).toContain("noAdherentes,");
    expect(FORM).toContain("digestivosSePresentan: saltoDigestivo ? saltoDigestivo.sePresentan : null");
  });

  it("y las cuatro lecturas salen de esa lista, no cada una de la suya", () => {
    expect(FORM).toContain("const totalPreguntas = questions.length;");
    expect(FORM).toContain("setRespondidas(questions.length - countUnanswered(form));");
    expect(FORM).toContain("return questions.filter((q) => {");
    expect(FORM).toContain("for (const q of questions) {");
  });

  it("la frontera de la adherencia por producto NO vive en la pantalla", () => {
    // Estaba escrita a mano con las dos cadenas de su §2.3 copiadas, o sea una segunda definicion de
    // "adherente al producto" dentro de un componente.
    expect(FORM).toContain("noAdherentesAlProducto(s1PorProducto)");
    expect(FORM, "la pantalla volvio a decidir la adherencia").not.toContain("5 o más días por semana");
  });

  it("y el S1 ya respondido vuelve al estado al reanudar, o el S2 desaparece", () => {
    expect(FORM).toContain("parsePorProducto(itemS1 ? prefill?.[itemS1.id] : null)");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA DE COMPLETAR LA ENCUESTA SE ARMA POR EL INSTRUMENTO SELLADO
//
// *"/encuesta/editar abre la encuesta de LINEA BASE: no trae el modulo de seguimiento ni el Cierre."* Es
// el mismo defecto que el 8 de noviembre dejo invisible el Modulo S en la vista de lectura, en la otra
// pantalla: las dos pedian las preguntas de la VERSION sellada en la respuesta, que es la del
// cuestionario y no incluye el Modulo S.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la pantalla de completar la encuesta", () => {
  const LECTOR = sinComentarios(
    readFileSync("src/modules/evaluations/data/survey-answers-reader.ts", "utf8"),
  );

  it("las DOS funciones publicas resuelven el instrumento de la consulta", () => {
    // Una sola que lo haga deja la otra pantalla armando la encuesta equivocada, que es lo que paso.
    expect(LECTOR.match(/instrumentoDeLaConsulta\(evaluationId\)/g)?.length).toBe(2);
    expect(LECTOR.match(/leerPorInstrumento\(/g)?.length, "falta un despacho por instrumento").toBe(3);
  });

  it("y el formulario del profesional sabe pintar el S1 y el S2", () => {
    const EDITAR = sinComentarios(
      readFileSync("src/modules/evaluations/components/survey-edit-form.tsx", "utf8"),
    );
    expect(EDITAR).toContain('q.questionType === "opcion_por_producto"');
    expect(EDITAR).toContain("<PreguntaPorProducto");
  });
});
