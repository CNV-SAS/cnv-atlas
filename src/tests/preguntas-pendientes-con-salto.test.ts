import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// LA LISTA DE PREGUNTAS PENDIENTES LLEVA A CADA PREGUNTA (portado de su encuesta, 2026-09-04).
//
// QUE RESOLVIA. Atlas decia "te faltan 61 preguntas" y nada mas, asi que el paciente tenia que buscarlas a
// mano por ocho secciones. Su archivo lo resuelve con un listado donde cada fila salta a su pregunta.
//
// LO QUE **NO** SE PORTO, y es lo que este candado protege tanto como el salto: EL TONO. El suyo pinta las
// filas de ambar con numeros naranja y el contador en rojo, o sea que convierte lo que el paciente NO SABE
// en un error suyo. Eso contradice la frase que hay justo encima ("puedes enviarla asi y completarlas con
// tu profesional") y es de la familia de los encabezados de categoria que retiramos el 2026-08-31.
//
// LA REGLA CLINICA QUE MANDA AQUI, de Santiago: "si hay algo que no sabe, no entiende o no conoce, es
// mejor no responderlo para que el profesional lo ayude despues". Verificado que NO choca con el gate: el
// gate esta en SELLAR EL DIAGNOSTICO, no en enviar la encuesta ("el guardado por partes del intake es otro
// flujo y NO se toca", `run-pipeline.ts`). Asi que el permiso es verdad, y por eso se puede escribir.

const FORM = readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8");
const SIN_COMENTARIOS = sinComentarios(FORM);

describe("la lista existe y lleva a la pregunta", () => {
  it("cada fila salta a su sección y deja la pregunta a la vista", () => {
    expect(SIN_COMENTARIOS).toContain("const irAPregunta =");
    expect(SIN_COMENTARIOS).toContain("onClick={() => irAPregunta(q)}");
    expect(SIN_COMENTARIOS).toContain("scrollIntoView");
  });

  it("y el salto espera al cuadro siguiente, porque la sección destino aún no se ha pintado", () => {
    // `setStep` es estado: el nodo está montado pero oculto hasta que React pinta. Buscarlo antes devuelve
    // un elemento sin caja y `scrollIntoView` no hace nada. Es un fallo que se ve en un navegador y en
    // ningún test de los nuestros, así que la forma se fija aquí.
    expect(SIN_COMENTARIOS).toContain("requestAnimationFrame");
  });

  it("la pregunta tiene ancla, y sobre el CONTENEDOR, no sobre el control", () => {
    // Al saltar tiene que verse el enunciado. Si el ancla estuviera en el input, el paciente aterrizaría
    // en unas píldoras sin saber qué se le está preguntando.
    expect(SIN_COMENTARIOS).toContain("const anclaPregunta =");
    expect(SIN_COMENTARIOS).toContain("id={anclaPregunta(q.id)}");
    expect(SIN_COMENTARIOS).toContain("scroll-mt-24");
  });
});

describe("UNA sola vara para contar y para listar", () => {
  it("el conteo se deriva de la lista, no la recorre por su cuenta", () => {
    // Dos recorridos del mismo formulario son dos varas, y la barra al 100 % con el aviso diciendo que
    // faltan tres es exactamente el fallo que ya costó un smoke. `countUnanswered` es `sinResponder().length`.
    expect(SIN_COMENTARIOS).toContain("const sinResponder = (form: HTMLFormElement): SurveyQuestionView[]");
    expect(SIN_COMENTARIOS).toContain("const countUnanswered = (form: HTMLFormElement): number => sinResponder(form).length");
  });

  it("y el predicado sigue siendo el del gate del profesional", () => {
    // `isAnswered` es el mismo que usa el servidor. Si aquí se relajara, el paciente vería una encuesta
    // completa y el profesional un hueco.
    expect(SIN_COMENTARIOS).toContain("isAnswered(stored)");
    expect(FORM).toContain('from "@/modules/clinical-pipeline/services/survey-completeness"');
  });
});

describe("el tono: es una ayuda para navegar, no un reproche", () => {
  it("no usa la escala clínica ni el ámbar operativo para lo que el paciente no respondió", () => {
    // La regla completa vive en `capa-clinica-solo-veredictos.test.ts`. Aquí se afirma sobre esta pantalla
    // en concreto, porque es la que un paciente contesta y donde el color puede mover la respuesta.
    expect(SIN_COMENTARIOS).not.toMatch(/(?:text|bg|border)-clinical-/);
    expect(SIN_COMENTARIOS).not.toMatch(/(?:text|bg|border)-attention/);
  });

  it("y el permiso sigue escrito, que es la mitad que importa", () => {
    // Sin esto, alguien podría dejar la lista neutra y quitar la frase, y el defecto se invertiría: una
    // caja gris con 61 preguntas listadas y sin decir que puede enviarla igual presiona más, no menos.
    expect(FORM).toContain("Puedes enviarla así y completarlas con tu profesional");
    expect(FORM).toContain("Puedes dejar en blanco lo que no sepas");
  });

  it("la lista se acota, para que los dos botones no salgan de la pantalla del teléfono", () => {
    // Con 61 sin responder, listarlas todas dentro del aviso empuja "Enviar así" y "Volver a revisar"
    // fuera de la vista, y el paciente se queda con el reproche y sin las dos salidas.
    expect(SIN_COMENTARIOS).toContain("pendientes.slice(0, 8)");
    expect(SIN_COMENTARIOS).toContain("pendientes.length - 8");
  });
});
