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

  it("y el chip activo se trae a la vista al cambiar de paso", () => {
    // En una tira que se desplaza, si no, el paso actual queda fuera de pantalla.
    expect(FORM).toContain("scrollIntoView({ block: \"nearest\", inline: \"center\" })");
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

describe("el bloque final tiene UN camino de envío", () => {
  it("la fila de navegación se oculta mientras se confirma el envío", () => {
    // Había CUATRO botones a la vez y DOS que enviaban ("Enviar así" y "Enviar"), uno encima del otro, en
    // el momento de más atención. En un teléfono el pulgar alcanza los dos.
    expect(FORM).toContain('isLast && confirmMissing !== null ? "hidden" : ""');
  });

  it("y se conserva el hazard de las keys distintas (auto-envío del último paso)", () => {
    // Sin keys distintas React reutiliza el nodo al pasar de "Siguiente" a "Enviar" y el navegador
    // auto-envía al entrar a la última sección. Solo se ve en navegador real (CLAUDE.md).
    expect(FORM).toContain('key="nav-next"');
    expect(FORM).toContain('key="nav-submit"');
    expect(FORM).toContain('key="confirm-send"');
    expect(FORM).toContain('<Button key="confirm-send" type="button"');
  });
});

describe("tamaño táctil", () => {
  it("las opciones llegan a 44 px", () => {
    // No era el problema (las capturas lo desmintieron), pero es el mínimo recomendado y no cuesta nada.
    expect(WIDGETS).toContain("min-h-11");
  });
});
