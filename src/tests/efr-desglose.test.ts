import { describe, expect, it } from "vitest";

import { efrDesglose, efrStateNumber } from "@/clinical-engine/types";

// LA INVERSA DEL NUMERO DE ESTADO, y el candado es una IDA Y VUELTA, no una tabla escrita a mano.
//
// PARA QUE EXISTE: las cards del estado muestran la tabla de siete indicadores del paciente y del estado
// de REFERENCIA que el profesional explora. Del de referencia no hay snapshot: solo su numero. Si el
// desglose se equivocara, la card diria bandas que no son las de esa celda, y el profesional estaria
// comparando contra algo que no existe en la Diana.
//
// POR QUE IDA Y VUELTA: una tabla de 81 filas escrita a mano se puede copiar mal y el test la validaria
// contra el mismo error. Recorrer los 81 y comprobar que `efrStateNumber(efrDesglose(n)) === n` no admite
// eso: usa la funcion que YA gobierna la Diana como oraculo.

describe("efrDesglose: del numero de estado a sus dos ejes", () => {
  it("los 81 estados vuelven a su propio numero", () => {
    for (let n = 1; n <= 81; n++) {
      const d = efrDesglose(n);
      expect(d, `el estado ${n} deberia desglosarse`).not.toBeNull();
      expect(efrStateNumber(d!), `el estado ${n} no vuelve a si mismo`).toBe(n);
    }
  });

  it("y los ejes salen en el orden de la DIANA, no en el de la aritmetica", () => {
    // EL ERROR QUE ESTO IMPIDE, y es facil: en `efrStateNumber` la variable del eje IFC x IRC se llama
    // `rSector` y la del eje FFMI x FMI se llama `rRing`, al reves de como los llama la Diana. Quien lea
    // esa funcion para escribir la inversa tiene todas las papeletas de cruzarlos, y el resultado seguiria
    // sumando 81 estados: no fallaria por conteo, fallaria por contenido.
    //
    // Los dos casos son los de las capturas de Gildardo, o sea que el oraculo es su pantalla:
    //   · su paciente:  #4  -> "anillo A1 · sector E4"
    //   · su explorado: #81 -> "Anillo A9 | Radio E9"
    const cuatro = efrDesglose(4)!;
    expect(cuatro.ringIndex).toBe(0); // A1
    expect(cuatro.sectorIndex).toBe(3); // E4

    const ochentaYUno = efrDesglose(81)!;
    expect(ochentaYUno.ringIndex).toBe(8); // A9
    expect(ochentaYUno.sectorIndex).toBe(8); // E9
  });

  it("el centro y la periferia son los que dice su leyenda", () => {
    // "Centro #1 optimo, periferia #81 riesgo maximo". El #1 tiene que ser el par de MENOR riesgo en los
    // dos ejes (3,1 = alto/bajo) y el #81 el de mayor (1,3 = bajo/alto).
    const centro = efrDesglose(1)!;
    expect([centro.ifc, centro.irc]).toEqual([3, 1]);
    expect([centro.ffmi, centro.fmi]).toEqual([3, 1]);

    const periferia = efrDesglose(81)!;
    expect([periferia.ifc, periferia.irc]).toEqual([1, 3]);
    expect([periferia.ffmi, periferia.fmi]).toEqual([1, 3]);
  });

  it("fuera de rango devuelve null, no una celda inventada", () => {
    // Una card que reciba un numero malo tiene que quedarse SIN tabla, no con una tabla plausible.
    for (const malo of [0, 82, -1, 4.5, Number.NaN]) {
      expect(efrDesglose(malo), `${malo} no es un estado`).toBeNull();
    }
  });
});
