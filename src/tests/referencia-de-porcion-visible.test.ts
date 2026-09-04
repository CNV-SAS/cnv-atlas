import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// LA REFERENCIA DE CANTIDAD DE D1 TIENE QUE VERSE.
//
// DE DONDE SALE (cotejo de la encuesta contra la de Gildardo, 2026-09-04). Santiago pidió adoptar sus
// "chips" de D1, del estilo "Un puño cerrado". Al mirarlo resultó que **el dato ya estaba en Atlas**:
// venía pegado al final de la línea gris de ejemplos, después de un " · ", donde el ojo lo salta. Lo que
// él resuelve con un chip nosotros lo teníamos escrito e invisible.
//
// Así que esto NO agregó contenido: ni una palabra que Gildardo no haya escrito. Es jerarquía. Y por eso
// lleva candado: un cambio de formato futuro puede volver a juntarlo en una sola línea sin que nada falle,
// y el defecto sería otra vez invisible por definición (se ve bien, solo que nadie lo lee).
//
// LO QUE MÁS IMPORTA DEL CANDADO es la segunda mitad: que la partición siga anclada al `field_key` y no al
// separador. El " · " aparece también fuera de D1 para cosas que no son una referencia de cantidad, así
// que partir por el separador a secas promovería a chip cualquier cola. Es la regla de siempre: un puente
// se ancla en un identificador, nunca en una posición.

const WIDGETS = readFileSync("src/modules/evaluations/components/survey-widgets.tsx", "utf8");
const SEED = readFileSync("supabase/seed.ts", "utf8");

/** Las preguntas del seed con su ayuda, tal como se siembran. */
const CON_AYUDA = [
  ...SEED.matchAll(/\{ key: "([a-z0-9_]+)", type: "([a-z_]+)", text: "([^"]*)", sub: "([^"]*)"/g),
].map((m) => ({ key: m[1], sub: m[4] }));

describe("la referencia de cantidad sale a su propia línea", () => {
  it("el widget parte la ayuda en ejemplos y referencia, y pinta las dos por separado", () => {
    expect(WIDGETS).toContain("function partirHint(");
    expect(WIDGETS).toContain("hint.ejemplos");
    expect(WIDGETS).toContain("hint?.referencia");
  });

  it("y la partición se ancla en el `field_key`, NO en el separador", () => {
    // Si alguien la simplifica a "parte por ' · '", esto sale rojo. Y tiene que salir: fuera de D1 esa
    // cola es otra cosa (una aclaración del ítem), y promoverla a chip diría que es una cantidad.
    expect(WIDGETS).toContain('q.fieldKey?.startsWith("d1_")');
    expect(WIDGETS).toContain("partes.length !== 2");
  });
});

describe("la medición que sostiene esa decisión sigue siendo cierta", () => {
  // ESTE BLOQUE ES EL QUE DE VERDAD VIGILA, porque la regla de arriba solo es correcta mientras el dato
  // tenga esta forma. Si mañana se siembra una ayuda de D1 con tres partes, o una de otro dominio con
  // referencia de cantidad, la decisión deja de valer y hay que volver aquí.
  const conSeparador = CON_AYUDA.filter((q) => q.sub.includes(" · "));

  it("CONTROL: se leyeron preguntas del seed de verdad", () => {
    // Sin esto, un cambio de formato del seed dejaría las listas vacías y todo lo de abajo pasaría verde
    // sin haber mirado nada.
    expect(CON_AYUDA.length).toBeGreaterThan(10);
    expect(conSeparador.length).toBeGreaterThan(10);
  });

  it("todas las ayudas con separador son de D1", () => {
    const fuera = conSeparador.filter((q) => !q.key.startsWith("d1_")).map((q) => q.key);
    expect(
      fuera,
      "hay ayuda con ' · ' fuera de D1: revisa si es una referencia de cantidad antes de dejar la regla",
    ).toEqual([]);
  });

  it("y todas tienen exactamente dos partes: ejemplos y referencia", () => {
    const raras = conSeparador.filter((q) => q.sub.split(" · ").length !== 2).map((q) => q.key);
    expect(raras, "una ayuda de D1 con tres partes: el widget la muestra entera y hay que decidir").toEqual(
      [],
    );
  });

  it("las quince preguntas de frecuencia de D1 llevan su referencia", () => {
    // El alcance, fijado: son las quince de la matriz. Si una pierde su referencia al sembrar, el paciente
    // se queda sin la ayuda para estimar la cantidad justo en la pregunta que alimenta el motor.
    const d1 = CON_AYUDA.filter((q) => q.key.startsWith("d1_"));
    expect(d1).toHaveLength(15);
    for (const q of d1) {
      expect(q.sub.split(" · "), `${q.key} perdió su referencia de cantidad`).toHaveLength(2);
      expect(q.sub.split(" · ")[1].trim(), `${q.key} tiene la referencia vacía`).not.toBe("");
    }
  });
});

describe("sin emojis, que es regla del proyecto y además evita un signo", () => {
  it("la referencia no lleva el emoji de su archivo", () => {
    // Su chip es "📏 Un puño cerrado". CLAUDE.md prohíbe emojis en UI, así que va sin él; y de paso no
    // introduce un símbolo que el paciente pueda leer como una señal sobre su respuesta.
    for (const q of CON_AYUDA) {
      expect(/\p{Extended_Pictographic}/u.test(q.sub), `${q.key} trae un emoji en la ayuda`).toBe(false);
    }
  });
});
