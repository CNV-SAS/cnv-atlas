import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL INTAKE EN MOVIL (2026-08-26). Los arreglos salen de MIRAR el intake en un telefono, no de
// leer el codigo: el diagnostico que sacamos del codigo (pastillas pequeñas, maraña de opciones) resultó
// equivocado, y los problemas reales eran otros tres. Se blindan para que un cambio futuro no los reponga.

const FORM = readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8");
const WIDGETS = readFileSync("src/modules/evaluations/components/survey-widgets.tsx", "utf8");
const PAGE = readFileSync("src/app/(public)/encuesta/[token]/page.tsx", "utf8");

describe("la primera pantalla muestra preguntas", () => {
  it("la navegación de secciones NO envuelve en móvil: es una tira que se desplaza", () => {
    // Nueve chips envueltos ocupaban SIETE filas en el teléfono, más que el contenido útil. El paciente
    // abría la encuesta y no veía ni una pregunta.
    expect(FORM).toContain("flex-nowrap");
    expect(FORM).toContain("overflow-x-auto");
    expect(FORM).toContain("sm:flex-wrap");
  });

  it("y el chip activo se trae a la vista al cambiar de paso, SIN mover la página", () => {
    // ESTE CASO FIJABA EL BUG, no la garantía (corregido el 2026-09-04). Pinchaba la llamada literal
    // `scrollIntoView({ block: "nearest", inline: "center" })`, que era exactamente lo que subía la página
    // sola: `block: "nearest"` desplaza los ancestros con scroll INCLUIDO EL DOCUMENTO, y estaba en un
    // `ref` de función en línea, que React vuelve a adjuntar en cada render. Resultado: en cada render, la
    // página se subía hasta que el chip entraba en vista. Era el bug del scroll de las secciones largas.
    //
    // Lo que se afirma ahora es la GARANTÍA (el chip se centra al cambiar de paso) y, sobre todo, el
    // MEDIO: se mueve el `scrollLeft` de la tira, que no puede desplazar el documento ni aunque el efecto
    // corriera de más. Y el ref es estable, así que solo corre cuando cambia `step`.
    expect(FORM).toContain("tira.scrollTo({");
    expect(FORM).toContain("ref={activo ? chipActivoRef : undefined}");
    expect(FORM).toContain("}, [step]);");
    // Y NO vuelve el mecanismo que movía la página desde la tira.
    expect(FORM, "`scrollIntoView` en la tira vuelve a subir la página sola").not.toContain(
      'scrollIntoView({ block: "nearest"',
    );
  });

  it("el título de la sección NO se repite", () => {
    // Salía en la línea de progreso y otra vez como encabezado, con los chips en medio: dos renglones de
    // una pantalla que todavía no mostraba ninguna pregunta.
    expect(FORM).not.toContain("currentTitle");
  });

  it("la cabecera no se lleva la pantalla en móvil", () => {
    expect(PAGE).toContain("py-4 sm:px-4 sm:py-10");
    expect(PAGE).toContain("gap-4 rounded-2xl");
    expect(PAGE).toContain("sm:gap-8");
  });
});

describe("se ve dónde empieza cada pregunta", () => {
  it("cada bloque tiene su propia superficie en móvil", () => {
    // Antes el hueco entre dos preguntas era igual al hueco entre el enunciado y sus opciones: en una
    // lista de 18 no se distinguía un bloque del siguiente. Se separa por FONDO, como las referencias.
    expect(FORM).toContain("bg-muted/20 p-3 sm:bg-transparent");
  });

  it("y en pantalla ancha basta el aire, sin superficie", () => {
    expect(FORM).toContain("sm:p-0 sm:border-0");
    expect(FORM).toContain("gap-3 sm:gap-6");
  });
});

describe("el bloque de envío tiene UN camino, en cualquier sección", () => {
  it("la fila de navegación se oculta mientras se confirma el envío", () => {
    // Había CUATRO botones a la vez y DOS que enviaban ("Enviar así" y "Enviar"), uno encima del otro, en
    // el momento de más atención. En un teléfono el pulgar alcanza los dos.
    //
    // YA NO DEPENDE DE `isLast` (2026-11-09): con el botón de enviar en todas las secciones, esa
    // condición habría dejado los cuatro botones a la vez en las siete primeras.
    expect(FORM).toContain('confirmMissing !== null ? "hidden" : ""');
    expect(FORM, "el ocultado volvió a depender del último paso").not.toContain(
      'isLast && confirmMissing !== null ? "hidden" : ""',
    );
  });

  // ═══ EL AVISO DE LO QUE FALTA SALE DONDE SE PULSE ENVIAR ═══
  //
  // Su pedido: *"al pulsarlo, el mismo comportamiento del final: si faltan preguntas, el mismo aviso de
  // siempre y la confirmación"*. Si el aviso siguiera siendo del último paso, el botón de las otras
  // siete frenaría el envío a propósito y no mostraría por qué: un botón que no hace nada.
  it("el aviso de lo que falta no es del último paso", () => {
    expect(FORM).toContain('{confirmMissing !== null ? (');
    expect(FORM, "el aviso volvió a ser del último paso").not.toContain('{isLast && confirmMissing !== null ? (');
  });

  // ═══ EL HAZARD 1, AHORA CERRADO POR CONSTRUCCION ═══
  //
  // Antes había UN nodo que pasaba de `type="button"` a `type="submit"` al entrar al último paso, y lo
  // único que evitaba el auto-envío eran las keys distintas. Ahora son dos nodos que no se intercambian:
  // el de enviar está montado en todos los pasos y su `type` no cambia nunca.
  it("el botón de enviar está siempre montado y su type no es condicional", () => {
    const i = FORM.indexOf('key="nav-submit"');
    expect(i, 'no se encontró el botón de enviar').toBeGreaterThan(0);
    const bloque = FORM.slice(i, i + 220);
    expect(bloque, 'el type del botón de enviar volvió a ser condicional').toContain('type="submit"');
    expect(bloque).not.toMatch(/type=\{/);
    // Y no cuelga de un ternario sobre `isLast`: el que desaparece en el último paso es "Siguiente".
    expect(FORM).toContain('{isLast ? null : (');
    expect(FORM, 'el envío volvió a existir solo en el último paso').not.toContain(
      '{isLast ? (\n            <Button key="nav-submit"',
    );
  });

  it("y se conservan las keys distintas de los tres botones", () => {
    // Son gratis y son el candado: si alguien vuelve a juntar los dos nodos en uno, las keys son lo
    // único que separa el nodo de "Siguiente" del de "Enviar" (CLAUDE.md, hazard 1).
    expect(FORM).toContain('key="nav-next"');
    expect(FORM).toContain('key="nav-submit"');
    expect(FORM).toContain('key="nav-back"');
    expect(FORM).toContain('key="confirm-send"');
    expect(FORM).toContain('<Button key="confirm-send" type="button"');
  });

  // ═══ HAZARD 5: EL ENVIO PROPIO NO LLEVA SUBMITTER ═══
  //
  // `new FormData(form)` NO incluye el `name`/`value` del botón que envió. Mientras ningún botón de este
  // formulario lleve datos en su `name`, no se pierde nada; el día que alguien se lo ponga, se perdería
  // en silencio. Así que se vigila que no lo lleven.
  it("ningún botón de navegación o envío lleva su dato en el name", () => {
    for (const key of ['nav-submit', 'nav-next', 'nav-back', 'confirm-send']) {
      const i = FORM.indexOf(`key="${key}"`);
      const bloque = FORM.slice(i, i + 220);
      expect(bloque, `${key} lleva un name: su valor NO viaja en new FormData(form)`).not.toMatch(
        /\sname=/,
      );
    }
  });

  // ═══ HAZARD 6: NINGUN `required` EN LA ENCUESTA DEL PACIENTE ═══
  //
  // Es lo que hace que enviar desde la sección 2 funcione de verdad: TODAS las secciones están montadas
  // (solo ocultas), así que un `required` en cualquiera de ellas lo validaría el navegador al enviar, no
  // podría enfocar un campo invisible, y el envío no haría nada sin decir por qué. Y además el diseño es
  // que el paciente puede dejar preguntas sin responder: *"puedes enviarla y completarlas con tu
  // profesional"*. Un `required` aquí contradice la frase que la propia pantalla muestra.
  it("ni el formulario ni sus widgets exigen ninguna respuesta", () => {
    for (const [nombre, src] of Object.entries({ formulario: FORM, widgets: WIDGETS })) {
      expect(src, `${nombre}: un required en la encuesta del paciente bloquea el envío desde otra sección`)
        .not.toMatch(/\srequired(\s|=|\/|>)/);
    }
  });
});

describe("tamaño táctil", () => {
  it("las opciones llegan a 44 px", () => {
    // No era el problema (las capturas lo desmintieron), pero es el mínimo recomendado y no cuesta nada.
    expect(WIDGETS).toContain("min-h-11");
  });
});
