import { describe, expect, it } from "vitest";

import {
  categoriaDeGrupoD1,
  clasificarD1,
  colorDeGrupoD1,
  d1TextoPatron,
  tarjetaD1,
  textoPatronDeGrupos,
  type D1Clasificacion,
} from "@/clinical-engine/d1-clasificacion";
import { FREQ_GROUPS } from "@/clinical-engine/frozen/engine.patron.js";
import type { PatronGrupoView } from "@/clinical-engine/patron";

// ═══ GOLDEN DE LA CLASIFICACION DE D1: SUS SIETE CASOS A-G (v16 §5) ═══
//
// Los casos no son nuestros: son la tabla de prueba de su documento del 2 de noviembre, con la misma base
// (protectores en 5 a 6 dias; cereales integrales, tuberculos y carnes blancas en 3 a 4 dias; refinados,
// azucares y ultraprocesados en "nunca") y los embutidos y las carnes rojas variando. El valor esperado
// sale de SU tabla, no de nuestra salida.
//
// QUE CUBRE Y QUE NO. Su tabla trae cuatro columnas de resultado: el patron, el dominio alimentario y el
// puntaje de Alimentacion del ICEC en v15 y en v16. Aqui se verifican las DOS primeras, que son las que
// este porte decide. Las dos del ICEC son `calcPatron` (su §4.2) y entran con el bump del motor y su
// recalculo (paso 3 del plan): hoy ese componente vale 30 para todos los pacientes, medido por la causa
// el 2026-11-05 (ninguna version de la encuesta declara `d1_9`/`d1_10`/`d1_16`), asi que no hay nada que
// comparar hasta que el ICEC mida.

/** Base de sus casos: el `enc` de los trece grupos que no varian. */
const BASE: Record<number, number> = {
  1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, // protectores: 5 a 6 dias
  8: 2, 9: 2, 10: 2, // cereales integrales, tuberculos y carnes blancas: 3 a 4 dias
  11: 0, 13: 0, 14: 0, // refinados, azucares y ultraprocesados: nunca
};

/** Los 15 grupos en la forma que entrega el reader del patron, con embutidos (12) y carnes rojas (15). */
function grupos(embutidos: number, carnesRojas: number): PatronGrupoView[] {
  const valores: Record<number, number> = { ...BASE, 12: embutidos, 15: carnesRojas };
  return FREQ_GROUPS.map((g) => ({
    n: g.n,
    cat: g.cat,
    label: g.label,
    ordinal: valores[g.n] ?? null,
  }));
}

/** Los 15 grupos sin ninguna frecuencia respondida. */
function sinResponder(): PatronGrupoView[] {
  return FREQ_GROUPS.map((g) => ({ n: g.n, cat: g.cat, label: g.label, ordinal: null }));
}

/**
 * El dominio alimentario, con la regla de su §3: dos o mas grupos en exceso es "critico", uno es
 * "alerta", el patron protector es "optimo" y el resto "normal".
 *
 * ESTA AQUI Y NO EN EL MOTOR A PROPOSITO. El dominio alimentario lo calcula `calcularDominios` (su §4.3),
 * que entra en el paso 5 del plan porque depende de que el ICEC ya mida. Lo que esta prueba verifica es
 * que la clasificacion YA LLEVA la informacion suficiente para decidirlo: las siete filas de su tabla
 * salen de `clasificarD1` sin consultar nada mas. Cuando el paso 5 cablee el dominio, esta funcion se
 * borra de aqui y el golden pasa a leer la del motor.
 */
function dominioAlimentario(c: D1Clasificacion): "critico" | "alerta" | "optimo" | "normal" {
  if (c.exceso.length >= 2) return "critico";
  if (c.exceso.length === 1) return "alerta";
  if (c.patron === "protector") return "optimo";
  return "normal";
}

const CASOS = [
  { caso: "A", embutidos: 3, rojas: 4, patron: "riesgo", dominio: "critico" },
  { caso: "B", embutidos: 4, rojas: 4, patron: "riesgo", dominio: "critico" },
  { caso: "C", embutidos: 3, rojas: 0, patron: "riesgo", dominio: "alerta" },
  { caso: "D", embutidos: 0, rojas: 0, patron: "protector", dominio: "optimo" },
  { caso: "E", embutidos: 0, rojas: 1, patron: "protector", dominio: "optimo" },
  { caso: "F", embutidos: 1, rojas: 2, patron: "moderado", dominio: "normal" },
  { caso: "G", embutidos: 2, rojas: 1, patron: "riesgo", dominio: "alerta" },
] as const;

describe("los siete casos A-G de su v16 §5", () => {
  it("son siete, ni uno menos", () => {
    expect(CASOS.map((c) => c.caso)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  for (const c of CASOS) {
    it(`caso ${c.caso}: patron ${c.patron} y dominio ${c.dominio}`, () => {
      const clas = clasificarD1(grupos(c.embutidos, c.rojas));
      expect(clas.patron).toBe(c.patron);
      expect(dominioAlimentario(clas)).toBe(c.dominio);
    });
  }
});

describe("el defecto que esto cierra: la tarjeta de riesgo ya no se diluye en el promedio", () => {
  // SU CAUSA 1, con el numero medido en la nube el 2026-11-05: a 11 pacientes de 631 la tarjeta de riesgo
  // les decia "Adecuado" EN VERDE teniendo un grupo de riesgo en 5-6 dias o diario. El promedio de los
  // cuatro grupos lo escondia.
  const CARD_RIESGO = [11, 12, 13, 14] as const;

  it("con embutidos 5 a 6 dias y los otros tres en nunca, el promedio daba 0,75", () => {
    // El numero exacto del defecto, para que quede claro por que pasaba y no solo que pasaba.
    const promedio = (3 + 0 + 0 + 0) / 4;
    expect(promedio).toBe(0.75);
    expect(promedio <= 1).toBe(true); // el corte viejo de "Adecuado"
  });

  it("y ahora esa misma encuesta da Elevado", () => {
    expect(tarjetaD1("riesgo", CARD_RIESGO, grupos(3, 0)).etiqueta).toBe("Elevado");
  });

  it("la barra de riesgo mide el PEOR grupo, no la media", () => {
    // Con la media, un grupo diario entre tres en "nunca" dibujaba una barra del 19 %.
    expect(tarjetaD1("riesgo", CARD_RIESGO, grupos(4, 0)).fraccionBarra).toBe(1);
  });

  it("un solo grupo de riesgo en 3 a 4 dias ya marca la tarjeta", () => {
    expect(tarjetaD1("riesgo", CARD_RIESGO, grupos(2, 0)).etiqueta).toBe("Elevado");
  });

  it("embutidos 1 a 2 dias quedan en Moderado, no en Adecuado (IARC grupo 1)", () => {
    expect(tarjetaD1("riesgo", CARD_RIESGO, grupos(1, 0)).etiqueta).toBe("Moderado");
  });

  it("sin ningun grupo de riesgo respondido dice Sin datos, no Adecuado", () => {
    expect(tarjetaD1("riesgo", CARD_RIESGO, sinResponder()).etiqueta).toBe("Sin datos");
  });
});

describe("la tarjeta de moderados: las carnes rojas por grupo, los otros tres por promedio", () => {
  const CARD_MOD = [8, 9, 10, 15] as const;

  it("carnes rojas diarias marcan Elevado aunque los otros tres esten en 3 a 4 dias", () => {
    expect(tarjetaD1("neutro", CARD_MOD, grupos(0, 4)).etiqueta).toBe("Elevado");
  });

  it("carnes rojas 3 a 4 dias quedan en Moderado (WCRF: hasta 3 porciones por semana)", () => {
    expect(tarjetaD1("neutro", CARD_MOD, grupos(0, 2)).etiqueta).toBe("Moderado");
  });

  it("y los tres sin senal de riesgo conservan su lectura por promedio", () => {
    // Con 8, 9 y 10 todos en diario el promedio pasa de 3 y la tarjeta sube, aunque ningun grupo tenga
    // estado de exceso: esa parte de su logica no cambio.
    const altos = FREQ_GROUPS.map((g) => ({
      n: g.n,
      cat: g.cat,
      label: g.label,
      ordinal: [8, 9, 10].includes(g.n) ? 4 : (BASE[g.n] ?? 0),
    }));
    expect(tarjetaD1("neutro", CARD_MOD, altos).etiqueta).toBe("Elevado");
  });

  it("los protectores no cambian: mas frecuencia sigue siendo mejor", () => {
    const CARD_PROT = [1, 2, 3, 4, 5, 6, 7] as const;
    expect(tarjetaD1("protector", CARD_PROT, grupos(0, 0)).etiqueta).toBe("Adecuado");
    const pocos = FREQ_GROUPS.map((g) => ({
      n: g.n,
      cat: g.cat,
      label: g.label,
      ordinal: g.cat === "protector" ? 1 : 0,
    }));
    expect(tarjetaD1("protector", CARD_PROT, pocos).etiqueta).toBe("Bajo");
  });
});

describe("la frase del patron es la de su archivo, palabra por palabra", () => {
  it("el caso del reporte de la nutricionista da su texto exacto", () => {
    // Verbatim de su §4.1: es el texto que el escribio como salida esperada para ese caso.
    expect(textoPatronDeGrupos(grupos(3, 4))).toBe(
      "Al evaluar el patrón usual de consumo de alimentos se encontró un patrón de riesgo, con consumo " +
        "elevado de carnes rojas (todos los días) y carnes procesadas y embutidos (5 a 6 días por semana).",
    );
  });

  it("sin ninguna frecuencia registrada lo dice, y no inventa un patron", () => {
    expect(textoPatronDeGrupos(sinResponder())).toBe(
      "Al evaluar el patrón usual de consumo de alimentos no se registraron frecuencias.",
    );
    expect(clasificarD1(sinResponder()).patron).toBe(null);
  });

  it("un patron protector nombra que no hay grupos por encima de su frecuencia aceptable", () => {
    expect(textoPatronDeGrupos(grupos(0, 0))).toContain(
      "sin grupos de riesgo por encima de su frecuencia aceptable",
    );
  });

  it("d1TextoPatron tolera que no le llegue clasificacion", () => {
    expect(d1TextoPatron(null)).toContain("no se registraron frecuencias");
  });
});

describe("la categoria y el color de cada grupo en la grilla", () => {
  it("las carnes rojas llevan Limitar, que no es ninguna de las tres categorias del modelo", () => {
    const g15 = grupos(0, 0).find((g) => g.n === 15) as PatronGrupoView;
    expect(categoriaDeGrupoD1(g15)).toEqual({ texto: "Limitar", color: "#b45309" });
  });

  it("los cuatro de riesgo llevan Riesgo, los protectores Protector y 8, 9 y 10 Moderar", () => {
    const todos = grupos(0, 0);
    const deN = (n: number) => categoriaDeGrupoD1(todos.find((g) => g.n === n) as PatronGrupoView).texto;
    for (const n of [11, 12, 13, 14]) expect(deN(n)).toBe("Riesgo");
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(deN(n)).toBe("Protector");
    for (const n of [8, 9, 10]) expect(deN(n)).toBe("Moderar");
  });

  it("embutidos 1 a 2 dias deja de pintarse verde", () => {
    const g12 = grupos(1, 0).find((g) => g.n === 12) as PatronGrupoView;
    expect(colorDeGrupoD1(g12)).toBe("#d97706"); // ambar: a moderar
  });

  it("carnes rojas 3 a 4 dias tampoco", () => {
    const g15 = grupos(0, 2).find((g) => g.n === 15) as PatronGrupoView;
    expect(colorDeGrupoD1(g15)).toBe("#d97706");
  });

  it("y carnes rojas en nunca sigue en verde, porque la frecuencia SI es la adecuada", () => {
    // El color habla de la frecuencia, no del alimento: por eso hace falta la etiqueta al lado.
    const g15 = grupos(0, 0).find((g) => g.n === 15) as PatronGrupoView;
    expect(colorDeGrupoD1(g15)).toBe("#059669");
  });

  it("un grupo sin responder va en gris", () => {
    expect(colorDeGrupoD1({ n: 12, cat: "riesgo", label: "x", ordinal: null })).toBe("#94a3b8");
  });
});
