import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LOS NUMEROS DE PANTALLA del recorrido de smoke.
//
// EL DEFECTO QUE EVITA, y ya paso una vez: un recorrido de smoke se escribe en el lenguaje de la PANTALLA
// ("Pregunta 14"), no en codigos internos ("d1_13_i"), porque el que lo ejecuta ve numeros. Pero ese numero
// es POSICIONAL: es el orden de la pregunta en la encuesta, no su identidad. En cuanto se inserta, se
// mueve o se reordena una pregunta, TODOS los numeros de abajo se corren y el documento manda a Santiago a
// la pregunta equivocada.
//
// Paso literalmente esta semana: al corregir el orden de la matriz de frecuencia, las carnes rojas se
// movieron de la 15 a la 11 y todo lo que venia detras cambio de numero. Un recorrido escrito antes habria
// quedado apuntando mal, sin dar ningun error.
//
// Asi que el par (codigo, numero) se ata aqui: el codigo es la identidad y el numero es lo que se escribe.

const DOC = "docs/SMOKE_CIENTIFICO_2026-08-29.md";

// Lo que el recorrido le pide a Santiago que responda, con el campo que de verdad alimenta cada pieza.
const PREGUNTAS: { key: string; numero: number; para: string }[] = [
  { key: "d1_13_i", numero: 14, para: "azúcares: riesgo glucémico y estrés + azúcares" },
  { key: "d2_21", numero: 21, para: "métodos para cambiar de peso: TCA activo" },
  { key: "d3_29", numero: 29, para: "estrés: estrés + azúcares" },
  { key: "d5_39", numero: 39, para: "diagnósticos: riesgo glucémico" },
  { key: "d7_agua", numero: 57, para: "agua: deshidratación e hidratación" },
  { key: "d7_58", numero: 60, para: "color de orina: deshidratación" },
  { key: "d4_34", numero: 34, para: "patrón alimentario: enciende la IA del menú" },
];

/** Numeracion CONTINUA 1..N por el orden del seed. Es la misma que calcula `survey-reader`. */
function numeroDePantalla(key: string): number {
  const keys = [
    ...readFileSync("supabase/seed.ts", "utf8").matchAll(/^\s*\{ key: "([a-z0-9_]+)"/gm),
  ].map((m) => m[1]);
  return keys.indexOf(key) + 1;
}

describe("el recorrido de smoke apunta a las preguntas correctas", () => {
  for (const q of PREGUNTAS) {
    it(`${q.key} es la Pregunta ${q.numero} (${q.para})`, () => {
      expect(
        numeroDePantalla(q.key),
        `${q.key} ya no es la ${q.numero}. Actualiza ${DOC}: si no, el recorrido manda a la pregunta ` +
          `equivocada y el smoke reporta un defecto que no existe (o peor, no ve el que sí).`,
      ).toBe(q.numero);
    });
  }

  it("y el documento cita ESOS números, no otros", () => {
    // La otra mitad: que el número del test y el del documento sean el mismo. Sin esto, el candado
    // verificaría el seed contra una tabla mía y el documento podría decir cualquier cosa.
    const doc = readFileSync(DOC, "utf8");
    for (const q of PREGUNTAS) {
      expect(doc, `el recorrido no cita la Pregunta ${q.numero} (${q.para})`).toContain(
        `**${q.numero}** ·`,
      );
    }
  });

  it("las opciones que el recorrido manda marcar existen en la encuesta", () => {
    // Un recorrido que manda marcar una opción que ya no existe hace perder el rato a quien lo ejecuta, y
    // lo peor es que parece defecto del software.
    const seed = readFileSync("supabase/seed.ts", "utf8");
    for (const opcion of ["Laxantes", "Diabetes tipo 2", "Oscuro (naranja / marrón)", "Vegetariano"]) {
      expect(seed, `la opción "${opcion}" ya no está en la encuesta`).toContain(`"${opcion}"`);
    }
  });
});
