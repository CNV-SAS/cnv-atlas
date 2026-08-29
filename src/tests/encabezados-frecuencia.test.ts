import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FREQ_GROUPS } from "@/clinical-engine";
import { encabezadoAntesDe } from "@/clinical-engine/encabezados-frecuencia";

// CANDADO DE LOS TRES ENCABEZADOS de la matriz de frecuencia.
//
// Su regla: "la agrupacion que ve el paciente es esa misma: EL ORDEN ES EL MENSAJE". Los encabezados
// hacen visible esa agrupacion, y por eso SOLO se pudieron poner despues de corregir el orden: con las
// carnes rojas al final, un encabezado "procesados a reducir" habria quedado encima de ellas, que su
// modelo clasifica como NEUTRAS. El encabezado habria hecho visible, y por tanto peor, un error implicito.

const claves = () =>
  [...readFileSync("supabase/seed.ts", "utf8").matchAll(/^\s*\{ key: "(d1_\d+_i)"/gm)].map((m) => m[1]);

describe("los encabezados salen de la categoría, no de una posición escrita a mano", () => {
  it("aparecen EXACTAMENTE tres, uno por categoría, en el orden del modelo", () => {
    const ks = claves();
    const vistos = ks
      .map((k, i) => encabezadoAntesDe(k, ks[i - 1] ?? null))
      .filter((e): e is string => e !== null);
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

  it("las etiquetas son las SUYAS (catLabel del frozen), solo sin el emoji", () => {
    // No una copia nuestra: dos fuentes del mismo texto sin nada que las compare es exactamente como
    // empezo el defecto del orden. Lo unico que cambia es la forma, que es nuestra: la interfaz no lleva
    // emoji. Si el cambia una etiqueta, esto cambia con el.
    const patron = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8");
    for (const e of [
      "Alimentación Real protectora",
      "Alimentación Real energética (moderar)",
      "Procesados y ultraprocesados (PCBU)",
    ]) {
      expect(patron).toContain(e);
    }
  });

  it("una pregunta que no es de la matriz no lleva encabezado", () => {
    expect(encabezadoAntesDe("d2_21", "d1_14_i")).toBe(null);
    expect(encabezadoAntesDe(null, "d1_1_i")).toBe(null);
    expect(encabezadoAntesDe("d1f_sal_i", "d1_14_i")).toBe(null);
  });
});
