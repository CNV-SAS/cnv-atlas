import { describe, expect, it } from "vitest";

import { ENGINE_REQUIRED } from "@/clinical-engine/edge/biody-columns";
import { SANITY } from "@/clinical-engine/edge/biody-import";

// LA DIANA NO PUEDE CLASIFICAR UN PACIENTE SIN MEDIR, y este candado fija POR QUE.
//
// EL DEFECTO ES DE SU PROTOTIPO, NO NUESTRO (su punto 9 del 2026-09-03): creando un paciente en blanco y
// entrando a Diagnostico, su Diana lo ubicaba en el estado #61 de 81 y emitia "Desnutricion severa sin
// inflamacion", con biomarcadores, riesgos y cinco nutraceuticos.
//
// LO REPRODUJIMOS CON NUESTROS PROPIOS CLASIFICADORES: con todo en cero devuelven {ifc:1, irc:1, ffmi:1,
// fmi:1}, que es el estado #61 exacto, con la misma etiqueta. O sea que **la vulnerabilidad de los cuatro
// clasificadores tambien esta en nuestro frozen**: son suyos y no distinguen cero de no medido.
//
// PERO EN ATLAS NO SE ALCANZA, y no por suerte: **el gate de entrada corta antes**. Medido ademas contra la
// base: de los 60 diagnosticos sellados, CERO tienen algun indice en cero o nulo.
//
// POR ESO NO SE PARCHEAN LOS CLASIFICADORES. Es ciencia congelada suya, y anadirles una guarda seria
// inventar un umbral clinico ("que es no medido") sin su texto, para cubrir un caso que no puede ocurrir.
// La solucion del gate es ademas MEJOR que la suya: cubre a TODOS los consumidores de los indices, no solo
// a la Diana, y se resuelve en un sitio en vez de en cuatro.
//
// LO QUE ESTE CANDADO PROTEGE es la cadena que lo hace cierto. Si alguien relaja un rango o saca una
// columna de la lista, el hazard pasa de latente a vivo SIN QUE NADA MAS FALLE: el diagnostico se sellaria
// igual, con un paciente colocado en la peor celda de la Diana.

/** Lo que cada indice de la Diana necesita para existir. Sale de `engine.core`: `calcIFC(C, Rinf)`,
 *  `calcIRC(Re, Ri, C)`, FFMI es columna directa y FMI = FM / talla². */
const INSUMOS_DE_LA_DIANA = {
  IFC: ["C", "Rinf"],
  IRC: ["Re", "Ri", "C"],
  FFMI: ["FFMI"],
  FMI: ["FM", "talla"],
} as const;

describe("el gate de entrada es lo que impide una Diana sin medición", () => {
  it("los insumos de los CUATRO índices son columnas REQUERIDAS", () => {
    // Sin esto, un indice podria calcularse desde una columna opcional y llegar en cero.
    for (const [indice, insumos] of Object.entries(INSUMOS_DE_LA_DIANA)) {
      for (const col of insumos) {
        expect(
          ENGINE_REQUIRED as readonly string[],
          `${indice} necesita ${col}, que tendria que ser un insumo REQUERIDO del motor`,
        ).toContain(col);
      }
    }
  });

  it("y NINGUNO de esos insumos admite el cero en su rango de cordura", () => {
    // Es la segunda capa, y la que de verdad cierra el caso: exigir PRESENCIA no basta, porque un cero
    // presente pasaria esa comprobacion. El rango es lo que lo rechaza.
    const insumos = [...new Set(Object.values(INSUMOS_DE_LA_DIANA).flat())];
    for (const col of insumos) {
      const rango = SANITY[col];
      expect(rango, `${col} deberia tener rango de cordura`).toBeDefined();
      expect(
        rango![0],
        `${col} admite el 0 en su rango [${rango![0]}, ${rango![1]}]: un cero pasaria el gate`,
      ).toBeGreaterThan(0);
    }
  });

  it("CONTROL: la lista de insumos no está vacía ni se quedó a medias", () => {
    // Una asercion "todos cumplen" pasa verde tambien sobre una lista vacia. Los cuatro indices y sus
    // SIETE columnas distintas tienen que estar (C, Rinf, Re, Ri, FFMI, FM, talla).
    //
    // Y este control ya sirvio: escribi "seis" al contarlas de memoria y el caso se puso rojo. Es
    // exactamente para lo que esta: una lista que se queda corta hace que el caso de arriba afirme
    // "todos cumplen" sobre menos insumos de los que hay.
    expect(Object.keys(INSUMOS_DE_LA_DIANA)).toHaveLength(4);
    expect([...new Set(Object.values(INSUMOS_DE_LA_DIANA).flat())]).toHaveLength(7);
  });
});
