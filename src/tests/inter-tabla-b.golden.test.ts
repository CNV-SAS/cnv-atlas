import { describe, expect, it } from "vitest";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { alimentosDe, INTER_TABLA_B } from "@/clinical-engine/intercambio-alimentos";

// Extracto verbatim en JS (sin tipos), a proposito: es la REFERENCIA, no codigo de la app.
import { INTER_TABLA_B as REF } from "./fixtures/reference/inter-tabla-b-vigente.js";

// CANDADO DE TRANSCRIPCION de INTER_TABLA_B (350 filas x 4 campos), el dataset mas grande que hemos
// portado. Un gramaje mal copiado no revienta nada: se muestra como dato clinico ("Arroz blanco (60 g)")
// y nadie lo notaria, ni en revision ni en uso. Por eso el candado cubre la tabla ENTERA, no una muestra.
//
// POR QUE UN deep-equal Y NO 350 ASSERCIONES: `toEqual` sobre los dos arreglos completos compara los 1.400
// campos en UNA sola operacion nativa, y cuando falla vitest imprime el diff con la fila exacta. Recorrer
// fila por fila daria el mismo error, 350 veces mas lento de escribir y sin mas informacion. Se mide el
// costo abajo (cuidado de Santiago: 350x4 podia volver el test lento).

const REF_TABLA = REF as { sub: string; al: string; g: number; med: string }[];

describe("INTER_TABLA_B: transcripcion verbatim de la entrega vigente", () => {
  it("es IDENTICA al extracto del v8, las 350 filas y los 4 campos", () => {
    // Las dos salieron del mismo HTML por script, pero por caminos distintos (una al fixture JS, otra al
    // modulo TS): si una transformacion futura toca una, esto lo caza.
    expect(INTER_TABLA_B).toEqual(REF_TABLA);
  });

  it("mantiene el CONTEO y el ORDEN (un reordenamiento silencioso tambien es una divergencia)", () => {
    expect(INTER_TABLA_B.length).toBe(350);
    expect(INTER_TABLA_B.map((a) => a.al)).toEqual(REF_TABLA.map((a) => a.al));
  });

  it("todos los gramajes son numeros positivos y finitos", () => {
    // Un `g` en 0, NaN o negativo se renderiza igual de plausible ("Arroz (0 g)") y es dato clinico falso.
    for (const a of INTER_TABLA_B) {
      expect(Number.isFinite(a.g), `gramaje de ${a.al}`).toBe(true);
      expect(a.g, `gramaje de ${a.al}`).toBeGreaterThan(0);
    }
  });

  it("ningun alimento queda huerfano: todo `sub` existe en INTER_TABLA_A", () => {
    // Es la clave de union entre las dos tablas. Un `sub` mal escrito (una tilde, un plural) NO rompe
    // nada: simplemente ese alimento no aparece nunca bajo su subgrupo, en silencio. Es el modo de fallo
    // mas probable de este porte, y el unico que un deep-equal contra el extracto no puede detectar
    // (si el HTML ya trajera el error, las dos copias coincidirian).
    const subsA = new Set(INTER_TABLA_A.map((r) => r.sub));
    const huerfanos = [...new Set(INTER_TABLA_B.filter((a) => !subsA.has(a.sub)).map((a) => a.sub))];
    expect(huerfanos).toEqual([]);
  });

  it("cada subgrupo de INTER_TABLA_A tiene al menos un alimento concreto", () => {
    // El reverso: un subgrupo sin alimentos deja la columna "ver N alimentos" vacia para ese alimento.
    const sinAlimentos = INTER_TABLA_A.filter((r) => alimentosDe(r.sub).length === 0).map((r) => r.sub);
    expect(sinAlimentos).toEqual([]);
  });
});
